require("dotenv").config();
const mongoose = require("mongoose");
const CryptoNetwork = require("./models/CryptoNetwork");

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("Mongo conectado");

    await CryptoNetwork.deleteMany({}); // limpia si hay algo

   await CryptoNetwork.insertMany([
  {
    currency: "USDT",
    network: "BEP20",
    depositAddress: "0xUSDT_BEP20_ADDRESS",
    isActive: true
  },
  {
    currency: "USDC",
    network: "BEP20",
    depositAddress: "0xUSDC_BEP20_ADDRESS",
    isActive: true
  },
  {
    currency: "BNB",
    network: "BEP20",
    depositAddress: "0xBNB_BEP20_ADDRESS",
    isActive: true
  },
  {
    currency: "SOL",
    network: "SOLANA",
    depositAddress: "SoLanaWalletAddress123456",
    isActive: true
  }
]);

    console.log("Networks seeded successfully");
  })
  .catch((err) => {
    console.error("Error:", err);
  });