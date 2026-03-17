const express = require("express");
const router = express.Router();
const VipProduct = require("../models/VipProduct");
const UserVip = require("../models/UserVip");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");

/*
========================================
1️⃣  COMPRAR VIP
========================================
*/
router.post("/buy/:vipId", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const vipProduct = await VipProduct.findById(req.params.vipId);

    if (!vipProduct) {
      return res.status(404).json({ message: "VIP no encontrado" });
    }

    if (user.balance < vipProduct.price) {
      return res.status(400).json({ message: "Saldo insuficiente" });
    }

    // Descontar saldo
    user.balance -= vipProduct.price;
    await user.save();

    // Calcular fecha de finalización
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + vipProduct.durationDays);

    // Crear contrato VIP del usuario
   const userVip = new UserVip({
  user: user._id,
  vipProduct: vipProduct._id,
  amount: vipProduct.price,
  dailyProfit: vipProduct.dailyProfit,
  endDate,
  status: "active", // <--- ASEGÚRATE DE AÑADIR ESTO EXPLÍCITAMENTE
  lastClaim: new Date() // También inicializa el lastClaim para evitar errores en el claim
});

    await userVip.save();

    res.json({ message: "VIP comprado correctamente", userVip });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al comprar VIP" });
  }
});

// Obtener los VIPs activos del usuario autenticado
router.get("/my-vips", authMiddleware, async (req, res) => {
  try {
    const vips = await UserVip.find({ user: req.user.id, status: "active" })
      .populate("vipProduct"); // Esto trae el nombre y detalles del VIP
    res.json(vips);
  } catch (error) {
    res.status(500).json({ msg: "Error al obtener tus VIPs" });
  }
});

// Obtener todos los productos VIP disponibles
router.get("/all", async (req, res) => {
    try {
        const products = await VipProduct.find();
        res.json(products);
    } catch (err) {
        res.status(500).json({ msg: "Error al obtener planes" });
    }
});

// Obtener los VIPs activos del usuario
router.get("/my-vips", authMiddleware, async (req, res) => {
    try {
        const vips = await UserVip.find({ user: req.user.id, status: "active" })
            .populate("vipProduct");
        res.json(vips);
    } catch (err) {
        res.status(500).json({ msg: "Error al obtener tus VIPs" });
    }
});

/*
========================================
2️⃣  RECLAMAR GANANCIA (24H)
========================================
*/
router.post("/claim/:id", authMiddleware, async (req, res) => {
  try {
    const userVip = await UserVip.findById(req.params.id);
    const user = await User.findById(req.user.id);
    const Transaction = require("../models/Transaction"); // Asegúrate de que esté importado

    if (!userVip || userVip.user.toString() !== user._id.toString()) {
      return res.status(404).json({ message: "VIP no encontrado" });
    }

    if (userVip.status !== "active") {
      return res.status(400).json({ message: "VIP ya finalizado" });
    }

    const now = new Date();

    // 1. Lógica de Finalización (Devolver Capital)
    if (now >= userVip.endDate) {
      user.balanceAvailable += userVip.amount; // Cambiado a balanceAvailable
      userVip.status = "finished";

      await Transaction.create({
        userId: user._id,
        type: "adjustment", // O "investment_return" si lo agregas al enum
        amount: userVip.amount,
        description: `Retorno de capital: ${userVip.amount}`
      });

      await user.save();
      await userVip.save();
      return res.json({ message: "Plan finalizado. Capital devuelto." });
    }

    // 2. Validación de tiempo
    const hoursPassed = (now - new Date(userVip.lastClaim)) / (1000 * 60 * 60);
    if (hoursPassed < 24) {
      return res.status(400).json({ message: "Espera 24 horas entre reclamos" });
    }

    // 3. Acreditar Ganancia y Registrar Movimiento
    user.balanceAvailable += userVip.dailyProfit; // ACREDITACIÓN REAL
    userVip.lastClaim = now;

    // Crear la transacción para el historial
    const claimTrans = new Transaction({
      userId: user._id,
      type: "profit", // El nuevo tipo que agregamos al modelo
      amount: userVip.dailyProfit,
      description: "Ganancia diaria de inversión VIP",
      status: "completed"
    });

    await user.save();
    await userVip.save();
    await claimTrans.save();

    res.json({
      message: "Ganancia acreditada correctamente",
      dailyProfit: userVip.dailyProfit
    });

  } catch (error) {
    console.error("Error en reclamo:", error);
    res.status(500).json({ message: "Error interno al procesar el reclamo" });
  }
});


/*
========================================
3️⃣  VER MIS VIP ACTIVOS
========================================
*/
router.get("/my-vips", authMiddleware, async (req, res) => {
  try {
    const userVips = await UserVip.find({
      user: req.user.id
    }).populate("vipProduct");

    res.json(userVips);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener VIPs" });
  }
});
/*
========================================
5️⃣  OBTENER TODOS LOS VIP DISPONIBLES
========================================
*/
router.get("/", async (req, res) => {
  try {
    const vips = await VipProduct.find();
    res.json(vips);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error obteniendo VIPs" });
  }
});



module.exports = router;
