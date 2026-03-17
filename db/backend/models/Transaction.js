const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  type: {
    type: String,
    enum: ["deposit", "withdraw", "investment", "adjustment", "profit", "reject"],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  address: { type: String }, 
  network: { type: String },
  status: { 
    type: String, 
    enum: ["pending", "completed", "rejected"], 
    default: "completed" 
  },
  approvedBy: { 
    type: String, 
    default: "System" 
  }, // <--- Ahora sí está dentro del esquema
  description: { type: String },
  createdAt: { // Usamos createdAt para consistencia
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Transaction", transactionSchema);