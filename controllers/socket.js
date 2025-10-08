
import jwt from "jsonwebtoken";
import User from "../models/user.js";


const handleSocketConnection = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.headers.access_token;
      if (!token) return next(new Error("Authentication invalid: No token"));

      const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      const user = await User.findById(payload.id);
      if (!user) return next(new Error("Authentication invalid: User not found"));

      socket.user = { id: payload.id, role: user.role };
      next();
    } catch (error) {
      console.error("Socket Auth Error:", error);
      next(new Error("Authentication invalid: Token verification failed"));
    }
  });

}
export default handleSocketConnection;