const socketIo = require("socket.io");
const handleSocketConnection = require("./controllers/socketAuth");
const userModel = require("./models/user");
const DriverModel = require("./models/driver");

let io;

function initializeSocket(server) {
  io = socketIo(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PATCH"],
    },
  });

  handleSocketConnection(io);

  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // --- JOIN EVENT ---
    socket.on("join", async (data) => {
      try {
        const { userId, userType } = data;

        if (userType === "user") {
          console.log("User joined:", userId);
          await userModel.findByIdAndUpdate(
            userId,
             { socketId: socket.id },
              { new: true }
            );
        } else if (userType === "driver") {
          console.log("Driver joined:", userId);
          await DriverModel.findByIdAndUpdate(
            userId,
             { socketId: socket.id },
              { new: true }
            );
        }
      } catch (err) {
        console.error("Error in join:", err);
      }
    });

    // --- DRIVER LOCATION UPDATE EVENT ---
    socket.on("update-location-driver", async (data) => {
      try {
        const { userId, location } = data;

        console.log("Location update received:", data);

        if (!location || !location.ltd || !location.lng) {
          return socket.emit("error", { message: "Invalid location data" });
        }

        // Update driver location in DB
        const driver = await DriverModel.findByIdAndUpdate(
          userId,
          { location: { ltd: location.ltd, lng: location.lng } },
          { new: true }
        );

        if (!driver) {
          console.log("Driver not found in DB")
          return;
        }

        console.log(`Driver ${userId} location updated:`, driver.location);
        // Broadcast to all connected users
        io.emit("driver-location-update", {
          driverId: userId,
          location: driver.location,
        });
      } catch (err) {
        console.error("Error in update-location-driver:", err);
      }
    });

    // --- DISCONNECT EVENT ---
    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}

// --- Send message by socketId (optional) ---
const sendMessageToSocketId = (socketId, messageObject) => {
  if (io) {
    io.to(socketId).emit(messageObject.event, messageObject.data);
  } else {
    console.log("Socket.io not initialized.");
  }
};

module.exports = { initializeSocket, sendMessageToSocketId };
