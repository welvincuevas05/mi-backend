module.exports = function (req, res, next) {
  // 1. Verificamos que exista el usuario y el rol
  if (!req.user || !req.user.role) {
    return res.status(403).json({ message: "Acceso denegado" });
  }

  // 2. Pasamos el rol a minúsculas antes de comparar
  const role = req.user.role.toLowerCase();

  if (role !== "admin" && role !== "ceo") {
    return res.status(403).json({ message: "Acceso solo para administradores" });
  }

  next();
};