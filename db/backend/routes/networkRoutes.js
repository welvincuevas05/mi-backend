const express = require("express");
const router = express.Router();
const CryptoNetwork = require("../models/CryptoNetwork");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

// ==========================================
// 1. RUTAS ESTÁTICAS (SIEMPRE ARRIBA)
// ==========================================

// LISTAR REDES ACTIVAS (Para Usuarios)
// URL: /api/networks/user-list
router.get("/user-list", authMiddleware, async (req, res) => {
    try {
        const networks = await CryptoNetwork.find({ isActive: true });
        res.json(networks);
    } catch (e) {
        res.status(500).json({ message: "Error obteniendo redes" });
    }
});

// LISTAR TODAS (Para CEO)
// URL: /api/networks/admin-list
router.get("/admin-list", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const networks = await CryptoNetwork.find().sort({ type: 1 });
        res.json(networks);
    } catch (e) {
        res.status(500).json({ message: "Error obteniendo lista completa" });
    }
});

// CREAR NUEVA RED
// URL: /api/networks/
router.post("/", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { network, currency, depositAddress, qrCode, type } = req.body;
        const newNetwork = await CryptoNetwork.create({
            network, currency, depositAddress, qrCode, type,
            isActive: true,
            updatedBy: req.user.id
        });
        res.json(newNetwork);
    } catch (error) {
        res.status(500).json({ message: "Error creando red" });
    }
});

// ==========================================
// 2. RUTAS DINÁMICAS (CON :ID - SIEMPRE ABAJO)
// ==========================================

// CAMBIAR ESTADO
router.patch("/toggle-status/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const network = await CryptoNetwork.findById(req.params.id);
        if (!network) return res.status(404).json({ message: "No encontrada" });
        network.isActive = !network.isActive;
        await network.save();
        res.json(network);
    } catch (error) {
        res.status(500).json({ message: "Error" });
    }
});

// ELIMINAR
router.delete("/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        await CryptoNetwork.findByIdAndDelete(req.params.id);
        res.json({ message: "Eliminada" });
    } catch (error) {
        res.status(500).json({ message: "Error" });
    }
});

module.exports = router;