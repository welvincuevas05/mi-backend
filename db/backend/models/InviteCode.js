const mongoose = require("mongoose");

const inviteCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    unique: true,
    required: true
  },
  role: {
    type: String,
    enum: ["admin", "support"],
    required: true
  },
  active: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model("InviteCode", inviteCodeSchema);
