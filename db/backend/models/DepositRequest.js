const mongoose = require("mongoose");

const depositRequestSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  network: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CryptoNetwork",
    required: true
  },

  amountCrypto: {
    type: Number,
    required: true
  },

  amountUSD: {
    type: Number
  },

  txid: {
    type: String,
    required: true
  },

  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending"
  },

  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  processedAt: Date

}, { timestamps: true });

module.exports = mongoose.model("DepositRequest", depositRequestSchema);
