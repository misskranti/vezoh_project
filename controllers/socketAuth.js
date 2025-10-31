const jwt = require("jsonwebtoken")
const User = require("../models/user.js")
const Driver = require("../models/driver.js")

const handleSocketConnection = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.headers.access_token
      if (!token) return next(new Error("Authentication invalid: No token"))

      const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

      // Try to find User first
      const user = await User.findById(payload.id)
      if (user) {
        socket.user = { id: payload.id, role: user.role }
        return next()
      }

      // Try to find Driver
      const driver = await Driver.findById(payload.id)
      if (driver) {
        socket.user = { id: payload.id, role: "driver" }
        return next()
      }

      // Neither user nor driver found
      return next(new Error("Authentication invalid: User/Driver not found"))
    } catch (error) {
      console.error("Socket Auth Error:", error)
      next(new Error("Authentication invalid: Token verification failed"))
    }
  })
}

module.exports = handleSocketConnection
