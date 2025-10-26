const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
const { initializeSocket } = require("./socket");

// Routes
const userRoutes = require("./routes/customerRoutes.js");
const driverRoutes = require("./routes/driverRoutes.js");

const { Server } = require("socket.io");
const { setIO } = require("./utils/socket");

const app = express();
const server = http.createServer(app);
initializeSocket(server);

app.set("trust proxy", 1);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.disable("x-powered-by")
app.use(helmet())

// Basic rate limiter for all API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 300, // 300 requests/window per IP
  standardHeaders: true,
  legacyHeaders: false,
})
app.use("/api/", apiLimiter)

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

// Initialize Socket.IO and expose via utils/socket
const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true,
  },
})
setIO(io)

// Basic connection handler + optional ride room join
io.on("connection", (socket) => {
  socket.on("join:ride", (rideId) => {
    if (!rideId) return
    const room = `ride:${rideId}`
    socket.join(room)
  })
})

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