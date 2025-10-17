const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
const { initializeSocket } = require('./socket');

// Routes
const userRoutes = require("./routes/customerRoutes.js");
const driverRoutes = require("./routes/driverRoutes.js");

const app = express();
const server = http.createServer(app);

initializeSocket(server);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => console.error("MongoDB connection error:", err));

// ============================
// API Routes
// ============================

app.use("/api/user", userRoutes);
app.use("/api/driver", driverRoutes);

// Root route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Vezoh Backend API is running",
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Something went wrong!",
    error:
      process.env.NODE_ENV === "development" ? err.message : "Internal server error",
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Vezoh Backend Server running on port ${PORT}`);
});