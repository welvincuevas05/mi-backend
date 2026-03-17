const express = require("express");
const router = express.Router();
const Transaction = require("../models/Transaction"); // Tu modelo de transacciones
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/request", authMiddleware, async (req, res) => {
    try {
        const { amount, network, address } = req.body;
        
        // 1. Buscar al usuario por el ID del token
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        // 2. Convertir a número para evitar errores de texto
        const amountNum = Number(amount);

        // 3. Validar saldo disponible
        if (user.balanceAvailable < amountNum) {
            return res.status(400).json({ message: "Saldo insuficiente en balance disponible" });
        }

        // 4. LÓGICA CORRECTA DE SALDO:
        // Restamos del disponible y sumamos al bloqueado (apartado para revisión)
        user.balanceAvailable -= amountNum;
        user.balanceLocked = (user.balanceLocked || 0) + amountNum; 
        
        await user.save();

        // 5. Crear la transacción de tipo "withdraw"
        const newTransaction = new Transaction({
            userId: user._id,
            type: "withdraw",
            amount: -amountNum, // Negativo porque es una salida de dinero
            network,
            address,
            status: "pending" // Queda pendiente hasta que el admin la apruebe
        });

        await newTransaction.save();

        res.json({ 
            message: "Retiro solicitado con éxito. El saldo ha sido apartado para revisión.",
            nuevoBalance: user.balanceAvailable 
        });

    } catch (e) {
        console.error("Error en proceso de retiro:", e);
        res.status(500).json({ message: "Error interno del servidor al procesar el retiro" });
    }
});

module.exports = router;