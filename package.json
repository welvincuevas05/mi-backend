const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const cors = require("cors");
dotenv.config();

const app = express();
app.use(cors());

// Conectar DB
connectDB();

// Middleware JSON
app.use(express.json());

// --- SECCIÓN DE RUTAS EN SERVER.JS ---

// 1. Rutas de Usuario y Auth
app.use("/api/auth", require("./routes/auth"));
app.use("/api/user", require("./routes/userRoutes"));
app.use("/api/invest", require("./routes/investRoutes"));
app.use("/api/vip", require("./routes/vipRoutes"));

// 2. Rutas de Redes y Depósitos (Lado Usuario)
app.use("/api/networks", require("./routes/networkRoutes"));
app.use("/api/deposits", require("./routes/depositRoutes"));
app.use("/api/withdrawals", require("./routes/withdrawalRoutes"));

// 3. RUTAS DE ADMINISTRADOR (CENTRALIZADAS)
// Importamos el archivo una sola vez
const adminRoutes = require("./routes/adminDepositRoutes"); 

// Asegúrate de que esta línea esté DEBAJO de los middlewares de JSON y CORS
app.use("/api/admin", adminRoutes);

// -------------------------------------

const PORT = process.env.PORT || 3000;



app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
