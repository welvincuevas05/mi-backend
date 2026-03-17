const mongoose = require("mongoose");

const cryptoNetworkSchema = new mongoose.Schema({
  network: { type: String, required: true },  // Ej: TRC20
  currency: { type: String, required: true }, // Ej: USDT
  depositAddress: { type: String, default: "" }, // Solo para depósitos
  qrCode: { type: String, default: "" },        // URL de la imagen QR
  type: { 
    type: String, 
    enum: ["deposit", "withdrawal"], 
    default: "deposit" 
  },
  isActive: { type: Boolean, default: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

module.exports = mongoose.model("CryptoNetwork", cryptoNetworkSchema);