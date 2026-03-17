const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, "El nombre de usuario es obligatorio"],
    unique: true,
    trim: true,
    minlength: [4, "El nombre de usuario debe tener al menos 4 caracteres"],
    maxlength: [20, "El nombre de usuario no puede exceder los 20 caracteres"],
    match: [/^[a-zA-Z0-9_]+$/, "El nombre de usuario solo puede contener letras, números y guiones bajos"]
  },
  email: {
    type: String,
    required: [true, "El correo electrónico es obligatorio"],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Por favor, ingresa un correo electrónico válido"]
  },
  password: {
    type: String,
    required: [true, "La contraseña es obligatoria"],
    minlength: [8, "La contraseña debe tener al menos 8 caracteres"]
  },

  role: {
    type: String,
    // Agregamos "ceo" para que coincida con tu lógica del frontend
    enum: ["user", "admin", "support", "ceo"], 
    default: "user"
  },

  isBlocked: {
    type: Boolean,
    default: false
  },

  // CAMPO NUEVO: Para manejar suspensiones temporales
  suspendedUntil: {
    type: Date,
    default: null
  },

  referralCode: {
    type: String,
    unique: true,
    trim: true
  },

  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },

  balanceAvailable: {
    type: Number,
    default: 0,
    min: [0, "El balance no puede ser negativo"]
  },
  balanceFrozen: {
    type: Number,
    default: 0,
    min: [0, "El balance no puede ser negativo"]
  },
  balanceLocked: { 
    type: Number,
    default: 0, 
    min: [0, "El balance no puede ser negativo"]
  },

  totalCommissions: {
    type: Number,
    default: 0,
    min: [0, "Las comisiones no pueden ser negativas"]
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("User", userSchema);