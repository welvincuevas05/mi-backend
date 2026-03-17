const jwt = require("jsonwebtoken");
const User = require("../models/User"); // Importa tu modelo de Usuario

module.exports = async function (req, res, next) {
  const authHeader = req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ msg: "No autorizado" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // BUSCAMOS AL USUARIO PARA TRAER EL ROL ACTUALIZADO DE LA DB
    const user = await User.findById(decoded.id).select("-password");
    
    if (!user) return res.status(401).json({ msg: "Usuario no existe" });

    req.user = user; // <--- Ahora req.user TIENE el .role
    next();
  } catch (error) {
    return res.status(401).json({ msg: "Token inválido" });
  }
};
