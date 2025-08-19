const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./config/database");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");

dotenv.config();

const app = express();

app.use(express.json());

connectDB();

app.get("/", (req, res) => {
  res.send("Vezoh API is running...");
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
