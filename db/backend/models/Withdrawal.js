const mongoose = require("mongoose");

const withdrawalSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "USDT" },
    network: { type: String, required: true },
    address: { type: String, required: true },
    status: { 
        type: String, 
        enum: ["pending", "approved", "rejected"], 
        default: "pending" 
    },
    adminMessage: { type: String, default: "" }
}, { timestamps: true });

module.exports = mongoose.model("Withdrawal", withdrawalSchema);