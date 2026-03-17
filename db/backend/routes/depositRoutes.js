const express = require("express");
const router = express.Router();
const DepositRequest = require("../models/DepositRequest");
const authMiddleware = require("../middleware/authMiddleware");



router.post("/", authMiddleware, async (req, res) => {
    try {
  

        const { network, amount, txid } = req.body;

        // 1. Validar campos y longitud de TXID
        if (!network || !amount || !txid) {
            return res.status(400).json({ message: "Todos los campos son necesarios." });
        }
        
        if (txid.trim().length < 10) {
            return res.status(400).json({ message: "El TXID parece inválido. Por favor, verifica el comprobante." });
        }

        // 2. Evitar TXIDs duplicados
        const duplicado = await DepositRequest.findOne({ txid: txid.trim() });
        if (duplicado) {
            return res.status(400).json({ message: "Este TXID ya ha sido registrado previamente." });
        }

        // 3. Crear solicitud
        const nuevaSolicitud = new DepositRequest({
            user: req.user.id,
            network: network,
            amountCrypto: Number(amount),
            amountUSD: Number(amount),
            txid: txid.trim(),
            status: "pending"
        });

        await nuevaSolicitud.save();
        res.status(201).json({ message: "Tu depósito está siendo procesado por el administrador." });

    } catch (error) {
        console.error("Error al crear depósito:", error);
        res.status(500).json({ message: "Error interno al procesar el depósito." });
    }
});

module.exports = router;