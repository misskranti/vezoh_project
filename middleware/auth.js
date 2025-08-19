const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Driver = require("../models/Driver");

const authMiddleware = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findById(decoded.userId).select(
        "-password -__v -createdAt -updatedAt"
      );

      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      req.user = user.toObject();

      if (decoded.role === "driver") {
        const driver = await Driver.findOne({ user: decoded.userId }).select(
          "-__v -createdAt -updatedAt"
        );
        req.user.driver = driver;
      }

      next();
    } catch (err) {
      console.error("Auth error:", err.message);
      return res.status(401).json({ error: "Not authorized, token failed" });
    }
  }

  if (!token) {
    return res.status(401).json({ error: "Not authorized, no token" });
  }
};

module.exports = authMiddleware;
