const mongoose = require("mongoose");

const vipProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  dailyProfit: {
    type: Number,
    required: true
  },
  durationDays: {
    type: Number,
    default: 30
  }
});

module.exports = mongoose.model("VipProduct", vipProductSchema);
