const mongoose = require("mongoose");

const conectarDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB conectada OK");
  } catch (error) {
    console.error("Error MongoDB:", error.message);
    process.exit(1);
  }
};

module.exports = conectarDB;
