const mongoose = require("mongoose");

const userVipSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  vipProduct: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "VipProduct",
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  dailyProfit: {
    type: Number,
    required: true
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },
  lastClaim: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ["active", "finished"],
    default: "active"
  }
});

module.exports = mongoose.model("UserVip", userVipSchema);
