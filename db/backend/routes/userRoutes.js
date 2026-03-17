const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const Investment = require('../models/Investment');
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const UserVip = require("../models/UserVip");
const authMiddleware = require("../middleware/authMiddleware");

/* =========================================
   1. PERFIL Y BALANCE
   ========================================= */

// Obtener datos completos del perfil (incluye balances)
router.get('/profile', authMiddleware, async (req, res) => {
    try {
        // Buscamos al usuario por el ID del token, quitando el password por seguridad
        const user = await User.findById(req.user.id).select('-password');
        
        if (!user) {
            return res.status(404).json({ msg: "Usuario no encontrado" });
        }
        
        res.json(user);
    } catch (err) {
        console.error("Error en /profile:", err.message);
        res.status(500).send('Error de servidor');
    }
});

/* =========================================
   2. HISTORIAL DE TRANSACCIONES
   ========================================= */

// Obtener historial completo (Corregido para tu modelo Transaction)
router.get("/my-transactions", authMiddleware, async (req, res) => {
    try {
        // Buscamos TODOS los tipos de transacciones de este usuario
        const transactions = await Transaction.find({ userId: req.user.id })
            .sort({ date: -1 });

        
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ message: "Error al cargar" });
    }
});

/* =========================================
   3. ESTADÍSTICAS Y GANANCIAS
   ========================================= */

// Calcular ganancia diaria basada en los VIPs que posee el usuario


/* =========================================
   3. ESTADÍSTICAS Y GANANCIAS (CORREGIDO)
   ========================================= */

// 2. Define la ruta exacta que el frontend está pidiendo
// En userRoutes.js
router.get("/my-investments", authMiddleware, async (req, res) => {
    try {
        const inversiones = await UserVip.find({ 
            user: req.user.id, 
            status: "active" 
        }).populate("vipProduct"); // <--- AGREGA ESTO para traer los detalles del producto (nombre, etc.)
        
        res.json(inversiones);
    } catch (error) {
        console.error("Error obteniendo inversiones:", error);
        res.status(500).json({ message: "Error interno" });
    }
});

// CORRECCIÓN: Calcular ganancia diaria sumando los registros de UserVip
// En userRoutes.js
router.get("/daily-earnings", authMiddleware, async (req, res) => {
    try {
        const vipsActivos = await UserVip.find({ 
            user: req.user.id, 
            status: "active" 
        });

        // Sumamos los valores de la columna 'dailyProfit' que vimos en tu Compass
        const total = vipsActivos.reduce((acc, vip) => acc + (vip.dailyProfit || 0), 0);
        
        res.json({ dailyEarnings: total });
    } catch (error) {
        res.json({ dailyEarnings: 0 });
    }
});

// DEJA SOLO UNA VERSIÓN DE ESTA RUTA
router.get("/referrals/stats", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);

        // Porcentajes de comisión definidos por nivel
        const comisionesConfig = { 1: 0.05, 2: 0.03, 3: 0.01 };

        const obtenerDatosNivel = async (parentIds, nivel) => {
    const referidos = await User.find({ referredBy: { $in: parentIds } }).select('username createdAt _id');
    const resData = [];
    const comisionesConfig = { 1: 0.05, 2: 0.03, 3: 0.01 };

    for (const ref of referidos) {
        // CORRECCIÓN: Usamos userId que es como lo guardas en investRoutes
        const inversiones = await Investment.find({ userId: ref._id });
        const totalInvertido = inversiones.reduce((sum, inv) => sum + inv.amount, 0);
        
        resData.push({
            _id: ref._id,
            username: ref.username,
            fecha: ref.createdAt,
            nivel: nivel,
            deposito: totalInvertido,
            ganancia: totalInvertido * comisionesConfig[nivel]
        });
    }
    return resData;
};

        // Ejecución en cascada para los 3 niveles
        const dataN1 = await obtenerDatosNivel([userId], 1);
        const idsN1 = dataN1.map(u => u._id);

        const dataN2 = await obtenerDatosNivel(idsN1, 2);
        const idsN2 = dataN2.map(u => u._id);

        const dataN3 = await obtenerDatosNivel(idsN2, 3);

        res.json({
            referralCode: user.referralCode,
            totalCommissions: user.totalCommissions || 0, // Esto viene del balance del usuario
            counts: { l1: dataN1.length, l2: dataN2.length, l3: dataN3.length },
            allReferrals: [...dataN1, ...dataN2, ...dataN3]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error calculando red de invitados" });
    }
});

// POST /api/user/update-password
router.post("/update-password", authMiddleware, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        
        // Es buena práctica verificar si el usuario existe antes de comparar
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

        // 1. Verificar la clave actual (Ahora sí funcionará porque bcrypt existe)
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "La contraseña actual es incorrecta" });
        }

        // 2. Encriptar la nueva
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        
        await user.save();
        res.json({ message: "¡Seguridad actualizada con éxito!" });
    } catch (e) {
        console.error(e); // Importante para que veas errores en los logs de Render
        res.status(500).json({ message: "Error interno del servidor" });
    }
});

module.exports = router;