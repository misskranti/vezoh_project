const Ride = require("../models/ride.js")
const Driver = require("../models/driver.js")

let getIO
try {
  ;({ getIO } = require("../utils/socket"))
} catch (_) {
  getIO = () => null
}

function emitRide(rideId, event, payload) {
  try {
    const io = getIO?.()
    if (io) io.to(`ride:${rideId}`).emit(event, payload)
  } catch {
    // ignore if socket not initialized
  }
}

exports.acceptRide = async (req, res) => {
  try {
    const driverId = req.user._id
    const { rideId } = req.params

    const ride = await Ride.findById(rideId)
    if (!ride) return res.status(404).json({ success: false, message: "Ride not found" })
    if (ride.status !== "requested")
      return res.status(400).json({ success: false, message: "Ride is not available to accept" })

    // attach driver and mark accepted
    ride.driver = driverId
    ride.status = "accepted"
    ride.timeline.acceptedAt = new Date()
    await ride.save()

    // mark driver busy
    await Driver.findByIdAndUpdate(driverId, { $set: { status: "busy" } })

    emitRide(ride._id, "ride:accepted", { rideId: ride._id, driverId })
    return res.json({ success: true, message: "Ride accepted", data: { rideId: ride._id } })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

exports.declineRide = async (req, res) => {
  try {
    const driverId = req.user._id
    const { rideId } = req.params

    const ride = await Ride.findById(rideId)
    if (!ride) return res.status(404).json({ success: false, message: "Ride not found" })
    
    // Check if this driver is assigned
    if (!ride.driver || String(ride.driver) !== String(driverId)) {
      return res.status(403).json({ success: false, message: "Not authorized for this ride" })
    }
    
    // Only allow decline if ride is in "accepted" status
    if (ride.status !== "accepted") {
      return res.status(400).json({ success: false, message: "Cannot decline ride at this stage" })
    }

    // Unassign driver and reopen ride
      ride.driver = null
      ride.status = "requested"
    ride.timeline.acceptedAt = null // Clear acceptance timestamp
      await ride.save()

    // Set driver back to online
    await Driver.findByIdAndUpdate(driverId, { $set: { status: "online" } })

      emitRide(ride._id, "ride:reopened", { rideId: ride._id })
    return res.json({ success: true, message: "Ride declined successfully" })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

exports.verifyPickupOtp = async (req, res) => {
  try {
    const driverId = req.user._id
    const { rideId } = req.params
    const { otp } = req.body

    const ride = await Ride.findById(rideId)
    if (!ride) return res.status(404).json({ success: false, message: "Ride not found" })
    if (!ride.driver || String(ride.driver) !== String(driverId))
      return res.status(403).json({ success: false, message: "Not authorized for this ride" })
    if (!["accepted", "driver_assigned", "pickup"].includes(ride.status))
      return res.status(400).json({ success: false, message: "Ride is not at pickup stage" })

    if (String(ride.OTPForStartRide) !== String(otp))
      return res.status(400).json({ success: false, message: "Invalid OTP" })

    // Start trip
    ride.status = "in_progress"
    ride.timeline.startedAt = new Date()
    await ride.save()

    emitRide(ride._id, "ride:started", { rideId: ride._id })
    return res.json({ success: true, message: "Pickup verified, trip started" })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

exports.progressUpdate = async (req, res) => {
  try {
    const driverId = req.user._id
    const { rideId } = req.params
    const { progressPercent, remainingMin, distanceKm } = req.body

    if (typeof progressPercent !== "number") {
      return res.status(400).json({ success: false, message: "progressPercent is required and must be a number" })
    }

    if (progressPercent < 0 || progressPercent > 100) {
      return res.status(400).json({ success: false, message: "progressPercent must be between 0 and 100" })
    }

    if (typeof remainingMin === "number" && remainingMin < 0) {
      return res.status(400).json({ success: false, message: "remainingMin cannot be negative" })
    }

    if (typeof distanceKm === "number" && distanceKm < 0) {
      return res.status(400).json({ success: false, message: "distanceKm cannot be negative" })
    }

    const ride = await Ride.findById(rideId)
    if (!ride) return res.status(404).json({ success: false, message: "Ride not found" })
    
    if (!ride.driver || String(ride.driver) !== String(driverId))
      return res.status(403).json({ success: false, message: "Not authorized for this ride" })
    
    if (ride.status !== "in_progress")
      return res.status(400).json({ success: false, message: "Ride is not in progress" })

    //  Update progress tracking
    ride.progress = ride.progress || {}
    ride.progress.percent = progressPercent
    ride.progress.lastUpdated = new Date()
    
    if (typeof remainingMin === "number") {
      ride.progress.remainingMin = remainingMin
    }
    
    //  Update distance traveled
    if (typeof distanceKm === "number") {
      ride.distance.actual = distanceKm
    }

    await ride.save()
    
    emitRide(ride._id, "ride:progress", { 
      rideId: ride._id, 
      progressPercent, 
      remainingMin, 
      distanceKm
    })
    
    return res.json({ 
      success: true, 
      message: "Progress updated",
      data: {
        progress: ride.progress,
        distance: ride.distance
      }
    })
  } catch (err) {
    console.error("Progress update error:", err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

exports.completeTrip = async (req, res) => {
  try {
    const driverId = req.user._id
    const { rideId } = req.params
    const { paymentMethod, finalFare } = req.body

    const ride = await Ride.findById(rideId)
    if (!ride) return res.status(404).json({ success: false, message: "Ride not found" })
    if (!ride.driver || String(ride.driver) !== String(driverId))
      return res.status(403).json({ success: false, message: "Not authorized for this ride" })
    if (!["in_progress", "pickup", "accepted"].includes(ride.status))
      return res.status(400).json({ success: false, message: "Ride not in completable state" })

    if (paymentMethod) ride.paymentMethod = paymentMethod
    if (typeof finalFare === "number") ride.fare.final = finalFare

    ride.status = "completed"
    ride.timeline.completedAt = new Date()
    
    //  Calculate total duration
    if (ride.timeline.startedAt) {
      const elapsedMs = new Date(ride.timeline.completedAt) - new Date(ride.timeline.startedAt)
      ride.duration.actual = Math.round(elapsedMs / 60000) // in minutes
    }
    
    //  Set progress to 100% on completion
    ride.progress = ride.progress || {}
    ride.progress.percent = 100
    ride.progress.remainingMin = 0
    ride.progress.lastUpdated = new Date()
    
    await ride.save()

    // update driver earnings/stats
    const credit = ride.fare?.final ?? ride.fare?.offered ?? ride.fare?.estimated ?? 0
    await Driver.findByIdAndUpdate(driverId, {
      $inc: {
        "earnings.today": credit,
        "earnings.thisWeek": credit,
        "earnings.thisMonth": credit,
        "earnings.total": credit,
        "earnings.availableToWithdraw": credit,
        "stats.completedTrips": 1,
        "stats.totalTrips": 1,
      },
      $set: { status: "online" },
    })

    emitRide(ride._id, "ride:completed", { 
      rideId: ride._id,
      duration: ride.duration.actual,
      distance: ride.distance.actual,
      fare: ride.fare.final
    })
    
    return res.json({ 
      success: true, 
      message: "Trip completed", 
      data: { 
        rideId: ride._id, 
        paid: ride.paymentStatus,
        duration: ride.duration.actual,
        distance: ride.distance.actual
      } 
    })
  } catch (err) {
    console.error("Complete trip error:", err)
    return res.status(500).json({ success: false, message: err.message })
  }
}