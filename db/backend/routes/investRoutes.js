const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Investment = require("../models/Investment");
const Transaction = require("../models/Transaction");
const VipProduct = require("../models/VipProduct");
const UserVip = require("../models/UserVip");
const authMiddleware = require("../middleware/authMiddleware");



router.post("/", authMiddleware, async (req, res) => {
  try {
  

    const { vipId } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    const vip = await VipProduct.findById(vipId);

    if (!user) return res.status(404).json({ msg: "Usuario no encontrado" });
    if (!vip) return res.status(404).json({ msg: "Producto VIP no encontrado" });

    if (user.balanceAvailable < vip.price) {
      return res.status(400).json({ msg: "Saldo insuficiente" });
    }

    // Lógica de Negocio
    user.balanceAvailable -= vip.price;
    user.balanceFrozen += vip.price;
    await user.save();

    const finalDate = new Date();
    finalDate.setDate(finalDate.getDate() + (vip.durationDays || 30));

    const newUserVip = new UserVip({
      user: userId,
      vipProduct: vipId,
      amount: vip.price,
      dailyProfit: vip.dailyProfit,
      endDate: finalDate,
      status: "active"
    });
    await newUserVip.save();

    await Transaction.create({
      userId,
      type: "investment",
      amount: -vip.price,
      description: `Activación de ${vip.name}`
    });

    // Aplicar comisiones a referidos
    await aplicarComisiones(user, vip.price);

    res.json({ 
      msg: "¡VIP activado exitosamente!",
      nuevoSaldoDisponible: user.balanceAvailable,
      vipActivo: newUserVip 
    });

  } catch (error) {
    console.error("Error en el proceso de inversión:", error);
    res.status(500).json({ msg: "Error interno del servidor" });
  }
});

const aplicarComisiones = async (usuarioQueInvirtio, monto) => {
    const porcentajes = [0.05, 0.03, 0.01];
    let currentParentId = usuarioQueInvirtio.referredBy;

    for (let i = 0; i < porcentajes.length; i++) {
        if (!currentParentId) break;
        const padre = await User.findById(currentParentId);
        if (padre) {
            const comision = monto * porcentajes[i];
            padre.balanceAvailable += comision;
            padre.totalCommissions += comision;
            await padre.save();

            await Transaction.create({
                userId: padre._id,
                amount: comision,
                type: 'profit', 
                description: `Comisión Nivel ${i + 1} de ${usuarioQueInvirtio.username}`
            });
            currentParentId = padre.referredBy;
        } else {
            break;
        }
    }
};

module.exports = router;