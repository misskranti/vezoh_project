const jwt = require("jsonwebtoken")
const User = require("../models/user")
const Driver = require("../models/driver")

const auth = async (req, res, next) => {
  try {
    const authHeader = req.header("Authorization")
    console.log("[v0] Auth header received:", authHeader)

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "No authorization header provided",
      })
    }

    let token
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.replace("Bearer ", "")
    } else {
      token = authHeader
    }

    console.log("[v0] Extracted token:", token ? token.substring(0, 20) + "..." : "null")

    if (!token || token === "null" || token === "undefined") {
      return res.status(401).json({
        success: false,
        message: "No token provided, authorization denied",
      })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    console.log("[v0] Decoded token:", decoded)

    // Check if it's a user or driver token
    if (decoded.role === "user") {
      const user = await User.findById(decoded.id).select("-password")
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found",
        })
      }
      req.user = user
      req.role = "user"
    } else if (decoded.role === "driver") {
      const driver = await Driver.findById(decoded.id).select("-password")
      if (!driver) {
        return res.status(401).json({
          success: false,
          message: "Driver not found",
        })
      }
      req.user = driver
      req.role = "driver"
    } else {
      return res.status(401).json({
        success: false,
        message: "Invalid token type",
      })
    }

    next()
  } catch (error) {
    console.error("Auth middleware error:", error)
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token format",
      })
    } else if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token has expired",
      })
    }
    res.status(401).json({
      success: false,
      message: "Token is not valid",
    })
  }
}

const driverAuth = async (req, res, next) => {
  try {
    const authHeader = req.header("Authorization")
    console.log("[v0] Driver auth header:", authHeader)

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "No authorization header provided",
      })
    }

    let token
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.replace("Bearer ", "")
    } else {
      token = authHeader
    }

    if (!token || token === "null" || token === "undefined") {
      return res.status(401).json({
        success: false,
        message: "No token provided, authorization denied",
      })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    if (decoded.role !== "driver") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Driver token required.",
      })
    }

    const driver = await Driver.findById(decoded.id).select("-password")
    if (!driver) {
      return res.status(401).json({
        success: false,
        message: "Driver not found",
      })
    }

    req.user = driver
    req.role = "driver"
    next()
  } catch (error) {
    console.error("Driver auth middleware error:", error)
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token format",
      })
    }
    res.status(401).json({
      success: false,
      message: "Token is not valid",
    })
  }
}

const userAuth = async (req, res, next) => {
  try {
    const authHeader = req.header("Authorization")
    console.log("[v0] User auth header:", authHeader)

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "No authorization header provided",
      })
    }

    let token
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.replace("Bearer ", "")
    } else {
      token = authHeader
    }

    if (!token || token === "null" || token === "undefined") {
      return res.status(401).json({
        success: false,
        message: "No token provided, authorization denied",
      })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    if (decoded.role !== "user") {
      return res.status(403).json({
        success: false,
        message: "Access denied. User token required.",
      })
    }

    const user = await User.findById(decoded.id).select("-password")
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      })
    }

    req.user = user
    req.role = "user"
    next()
  } catch (error) {
    console.error("User auth middleware error:", error)
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token format",
      })
    }
    res.status(401).json({
      success: false,
      message: "Token is not valid",
    })
  }
}

module.exports = { auth, driverAuth, userAuth }
