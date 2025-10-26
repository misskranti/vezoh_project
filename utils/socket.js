let ioInstance = null

function setIO(io) {
  ioInstance = io
}

function getIO() {
  if (!ioInstance) {
    throw new Error("Socket.IO instance not initialized")
  }
  return ioInstance
}

function rideRoom(rideId) {
  return `ride:${rideId}`
}

function emitToRide(rideId, event, payload) {
  if (!ioInstance) return
  ioInstance.to(rideRoom(rideId)).emit(event, payload)
}

module.exports = {
  setIO,
  getIO,
  emitToRide,
  rideRoom,
}
