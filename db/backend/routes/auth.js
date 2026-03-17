const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const InviteCode = require("../models/InviteCode");

const router = express.Router();


// Función para generar código aleatorio de 7 caracteres
function generarCodigoReferido(length = 7) {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let resultado = '';
    for (let i = 0; i < length; i++) {
        resultado += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    return resultado;
}

// =========================
// REGISTER
// =========================
router.post("/register", async (req, res) => {
  try {
    const { username, email, password, referralCode } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ msg: "Todos los campos son obligatorios" });
    }

    const userExist = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (userExist) {
      return res.status(400).json({ msg: "Usuario o correo ya existe" });
    }

    let assignedRole = "user";
    let referrer = null;

    if (referralCode) {

      // 1️⃣ Verificar si es código especial
      const specialInvite = await InviteCode.findOne({
        code: referralCode,
        active: true
      });

      if (specialInvite) {
        assignedRole = specialInvite.role;
      } else {
        // 2️⃣ Si NO es especial, buscar como código de referido normal
        referrer = await User.findOne({ referralCode });

        if (!referrer) {
          return res.status(400).json({ msg: "Código de referido inválido" });
        }
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // --- NUEVA LÓGICA DE CÓDIGO LIMPIO ---
    let generatedReferralCode;
    let codeExists = true;

    while (codeExists) {
        generatedReferralCode = generarCodigoReferido(7);
        const duplicate = await User.findOne({ referralCode: generatedReferralCode });
        if (!duplicate) codeExists = false;
    }
    // -------------------------------------

    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      referralCode: generatedReferralCode, // Aquí entra el código de 7 caracteres
      referredBy: referrer ? referrer._id : null,
      role: assignedRole
    });

    await newUser.save();

    res.status(201).json({
      msg: "Usuario registrado correctamente",
      referralCode: generatedReferralCode
    });

 } catch (error) {
    console.error("🔥 ERROR CRÍTICO EN REGISTRO:", error.message);
    console.error(error.stack); // Esto te dirá la línea exacta en los logs de Render
    res.status(500).json({ msg: "Error del servidor", error: error.message });
  }
});

// =========================
// LOGIN (CON FILTRO DE SUSPENSIÓN)
// =========================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ msg: "Credenciales inválidas" });
    }

    // 1️⃣ VALIDAR BLOQUEO PERMANENTE
    if (user.isBlocked) {
      return res.status(403).json({ msg: "Esta cuenta ha sido inhabilitada permanentemente." });
    }

    // 2️⃣ VALIDAR SUSPENSIÓN TEMPORAL
    if (user.suspendedUntil && user.suspendedUntil > new Date()) {
      const opciones = { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' };
      const fechaFormateada = user.suspendedUntil.toLocaleDateString('es-ES', opciones);
      
      return res.status(403).json({ 
        msg: `Tu cuenta está suspendida temporalmente. Podrás acceder después del: ${fechaFormateada}` 
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ msg: "Credenciales inválidas" });
    }

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        balance: user.balanceAvailable // Asegúrate de usar Available que es tu campo en el modelo
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error del servidor" });
  }
});

module.exports = router;
