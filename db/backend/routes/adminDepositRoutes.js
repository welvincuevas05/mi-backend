const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const DepositRequest = require("../models/DepositRequest");
const User = require("../models/User");
const Transaction = require("../models/Transaction");

// --- MIDDLEWARES (Importados una sola vez) ---
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// --- DEFINICIÓN DE PERMISOS ---
const permitSoporte = roleMiddleware(["admin", "support", "ceo"]);
const permitSoloAdmin = roleMiddleware(["admin", "ceo"]);

/* =========================================
   SECCIÓN: GESTIÓN DE DEPÓSITOS
========================================= */

// 🔎 VER DEPÓSITOS PENDIENTES
router.get("/deposits/pending", authMiddleware, permitSoporte, async (req, res) => {
  try {
    const deposits = await DepositRequest.find({ status: "pending" })
      .populate("user", "username email") 
      .populate("network"); 
    res.json(deposits);
  } catch (error) {
    res.status(500).json({ message: "Error obteniendo depósitos" });
  }
});

// ✅ APROBAR DEPÓSITO
router.post("/deposits/approve/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const amountUSD = req.body.amountUSD || req.body.amount;
    if (!amountUSD) return res.status(400).json({ message: "Monto requerido" });

    const deposit = await DepositRequest.findById(req.params.id);
    if (!deposit || deposit.status !== "pending") {
      return res.status(400).json({ message: "Depósito inválido o ya procesado" });
    }

    const user = await User.findById(deposit.user);
    user.balanceAvailable += Number(amountUSD);
    await user.save();

    deposit.status = "approved";
    deposit.amountUSD = amountUSD;
    deposit.processedBy = req.user.id;
    deposit.processedAt = new Date();
    await deposit.save();

    await Transaction.create({
      userId: user._id,
      type: "deposit",
      amount: amountUSD,
      description: "Depósito aprobado por administración",
      // Buscamos username, si no email, si no el ID, para no dejar el campo vacío
      approvedBy: req.user.username || req.user.email || req.user.id 
    });

    res.json({ message: "Depósito aprobado correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error aprobando depósito" });
  }
});


// ❌ RECHAZAR DEPÓSITO (Versión blindada)
router.post("/deposits/reject/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const deposit = await DepositRequest.findById(req.params.id);
    if (!deposit || deposit.status !== "pending") {
      return res.status(400).json({ message: "Depósito inválido o ya procesado" });
    }

    deposit.status = "rejected";
    deposit.processedBy = req.user.id;
    deposit.processedAt = new Date();
    await deposit.save();

    // Verificamos que el modelo Transaction exista antes de usarlo
    
        await Transaction.create({
          userId: deposit.user._id || deposit.user, 
          type: "deposit",
          amount: deposit.amountUSD || 0,
          description: `Depósito rechazado. TXID: ${deposit.txid || 'S/N'}`,
          approvedBy: req.user.username || req.user.email || "Admin"
        });
    

    res.json({ message: "Depósito rechazado correctamente" });
  } catch (error) {
    console.error("ERROR AL RECHAZAR:", error); // Esto lo verás en los logs de Render
    res.status(500).json({ message: "Error interno al procesar el rechazo" });
  }
});
/* =========================================
   SECCIÓN: AJUSTES MANUALES
========================================= */

router.post("/adjust-balance", authMiddleware, permitSoloAdmin, async (req, res) => {
  try {
    const { identifier, amount, action, title, description } = req.body;
    const cleanId = identifier.trim();

    let user = await User.findOne({
      $or: [
        { email: cleanId.toLowerCase() },
        { username: cleanId },
        { _id: cleanId.length === 24 ? cleanId : null }
      ]
    });

    if (!user && cleanId.length >= 4) {
       const allUsers = await User.find();
       user = allUsers.find(u => u._id.toString().toUpperCase().endsWith(cleanId.toUpperCase()));
    }

    if (!user) return res.status(404).json({ message: `No se encontró al usuario: ${cleanId}` });

    const valAmount = Number(amount);
    if (isNaN(valAmount) || valAmount <= 0) return res.status(400).json({ message: "Monto inválido" });

    if (action === 'add') {
      user.balanceAvailable += valAmount;
    } else {
      if (user.balanceAvailable < valAmount) return res.status(400).json({ message: "Saldo insuficiente" });
      user.balanceAvailable -= valAmount;
    }

    await user.save();

    await Transaction.create({
      userId: user._id,
      type: "adjustment",
      amount: action === 'add' ? valAmount : -valAmount,
      description: `[${title}] ${description}`,
      approvedBy: req.user.username || req.user.email || req.user.id // <--- Agregamos esto
    });

    res.json({ message: `Saldo actualizado para ${user.username}`, newBalance: user.balanceAvailable });
  } catch (error) {
    res.status(500).json({ message: "Error interno en ajuste de saldo" });
  }
});

/* =========================================
   SECCIÓN: RETIROS
========================================= */

// ❌ RECHAZAR RETIRO
router.post("/withdrawals/reject/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const withdrawalId = req.params.id;
        const { reason } = req.body; 

        const trans = await Transaction.findById(withdrawalId);
        if (!trans || trans.type !== 'withdraw' || trans.status !== 'pending') {
            return res.status(400).json({ message: "Retiro no encontrado o ya procesado" });
        }

        const user = await User.findById(trans.userId);
        if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

        const montoDevolver = Math.abs(trans.amount);
        user.balanceAvailable += montoDevolver;
        user.balanceLocked = Math.max(0, (user.balanceLocked || 0) - montoDevolver); 
        
        await user.save();

        trans.status = 'rejected';
        trans.description = `Rechazado: ${reason || 'Datos incorrectos'}`;
        await trans.save();

        res.json({ message: "Retiro rechazado y saldo devuelto" });
    } catch (e) {
        res.status(500).json({ message: "Error al rechazar retiro" });
    }
});

// ✅ APROBAR RETIRO
router.post("/withdrawals/approve/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const withdrawalId = req.params.id;
        const trans = await Transaction.findById(withdrawalId);
        
        if (!trans || trans.type !== 'withdraw' || trans.status !== 'pending') {
            return res.status(400).json({ message: "Transacción no válida" });
        }

        const user = await User.findById(trans.userId);
        user.balanceLocked = Math.max(0, (user.balanceLocked || 0) - Math.abs(trans.amount));
        await user.save();

        trans.status = 'completed';
        trans.description = "Retiro enviado con éxito";
        trans.approvedBy = req.user.username || req.user.email || req.user.id; // <--- Agregamos esto
        await trans.save();

        res.json({ message: "Retiro aprobado correctamente" });
    } catch (e) {
        res.status(500).json({ message: "Error al aprobar retiro" });
    }
});

// 🔎 VER RETIROS PENDIENTES
router.get("/withdrawals/pending", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const pendingWithdraws = await Transaction.find({ 
        type: "withdraw", 
        status: "pending" 
    }).populate("userId", "username email");
    
    res.json(pendingWithdraws);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener retiros" });
  }
});


// GET /api/admin/stats - Resumen rápido para los cuadros de arriba
router.get("/stats", authMiddleware, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments({ role: "user" });
        const deposits = await DepositRequest.find({ status: "approved" });
        const totalDeposits = deposits.reduce((acc, dep) => acc + dep.amountUSD, 0);
        
        const withdrawals = await Transaction.find({ type: "withdraw", status: "approved" });
        const totalWithdrawals = withdrawals.reduce((acc, w) => acc + Math.abs(w.amount), 0);

        res.json({ totalUsers, totalDeposits, totalWithdrawals });
    } catch (e) {
        res.status(500).json({ message: "Error al calcular stats" });
    }
});

// GET /api/admin/user-detail/:query
// GET /api/admin/user-detail/:query
router.get("/user-detail/:query", authMiddleware, permitSoporte, async (req, res) => {
    try {
        const { query } = req.params;
        const user = await User.findOne({
            $or: [
                { _id: mongoose.isValidObjectId(query) ? query : null }, 
                { email: query.toLowerCase() },
                { username: query }
            ]
        }).populate("referredBy", "username email");

        if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

        const referralCount = await User.countDocuments({ referredBy: user._id });
        const deposits = await DepositRequest.find({ user: user._id }).sort({ createdAt: -1 });
        const withdrawals = await Transaction.find({ userId: user._id, type: "withdraw" }).sort({ createdAt: -1 });
        
        // Enviamos la respuesta (Soporte ya tiene acceso aquí)
        res.json({ user, deposits, withdrawals, referralCount });
    } catch (e) {
        res.status(500).json({ message: "Error al buscar expediente" });
    }
});

// GET /api/admin/transactions/all - Ver todas las transacciones para auditoría
router.get("/transactions/all", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const transactions = await Transaction.find()
            .populate("userId", "username")
            .sort({ createdAt: -1 })
            .limit(1000); // Traemos las últimas 50 para no saturar
        res.json(transactions);
    } catch (e) {
        res.status(500).json({ message: "Error al obtener auditoría" });
    }
});

/* =========================================
   SECCIÓN: CONTROL DE USUARIOS (NUEVO)
========================================= */

// 🚫 BANEAR / DESBLOQUEAR USUARIO
router.post("/toggle-block", authMiddleware, permitSoporte, async (req, res) => {
    try {
        const { userId } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

        user.isBlocked = !user.isBlocked;
        await user.save();

        res.json({ message: user.isBlocked ? "Usuario bloqueado" : "Usuario desbloqueado" });
    } catch (error) {
        res.status(500).json({ message: "Error al cambiar estado de bloqueo" });
    }
});

// 🔑 RESETEAR CONTRASEÑA (DESDE ADMIN)
router.post("/update-user-pass", authMiddleware, permitSoporte, async (req, res) => {
    try {
        const { userId, newPass } = req.body;
        const bcrypt = require("bcryptjs"); // Asegúrate de que bcrypt esté disponible

        const salt = await bcrypt.genSalt(10);
        const hashedPass = await bcrypt.hash(newPass, salt);

        const user = await User.findByIdAndUpdate(userId, { password: hashedPass });
        if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

        res.json({ message: "Contraseña actualizada correctamente" });
    } catch (error) {
        res.status(500).json({ message: "Error al reseter contraseña" });
    }
});

// ⏳ SUSPENDER USUARIO POR DÍAS
router.post("/suspend-user", authMiddleware, permitSoporte, async (req, res) => {
    try {
        const { userId, dias } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

        const fechaFin = new Date();
        fechaFin.setDate(fechaFin.getDate() + parseInt(dias));

        user.suspendedUntil = fechaFin; // Asegúrate de tener este campo en tu modelo User.js
        await user.save();

        res.json({ message: `Suspendido hasta el ${fechaFin.toLocaleDateString()}` });
    } catch (error) {
        res.status(500).json({ message: "Error al suspender usuario" });
    }
});

// 👁️ CONTROLAR CUENTA (IMPERSONAR)
router.post("/impersonate/:email", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ email: req.params.email.toLowerCase() });
        
        if (!user) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        // Generar token con la identidad del usuario para el CEO
        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "2h" } // Token temporal para revisión
        );

        res.json({
            token,
            user: {
                id: user._id,
                username: user.username,
                role: user.role,
                balance: user.balanceAvailable
            }
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Error interno: revisa si JWT_SECRET está en Render" });
    }
});

module.exports = router;