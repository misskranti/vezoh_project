const Driver = require("../models/driver.js")
const Ride = require("../models/ride.js")

exports.earningsSummary = async (req, res) => {
  try {
    const driverId = req.user._id
    const limit = Number(req.query.limit || 10)

    const driver = await Driver.findById(driverId).select("earnings").lean()
    if (!driver) return res.status(404).json({ success: false, message: "Driver not found" })

    const recent = await Ride.find({ driver: driverId, status: "completed" })
      .sort({ completedAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 50))
      .select("origin destination distance duration fare completedAt")
      .lean()

    return res.json({
      success: true,
      data: { earnings: driver.earnings || {}, recent },
    })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

exports.withdraw = async (req, res) => {
  try {
    const driverId = req.user._id
    const amount = Number(req.body.amount)

    const driver = await Driver.findById(driverId).select("earnings").lean()
    if (!driver) return res.status(404).json({ success: false, message: "Driver not found" })

    const available = driver.earnings?.availableToWithdraw || 0
    if (amount <= 0) return res.status(400).json({ success: false, message: "Amount must be greater than 0" })
    if (amount > available) return res.status(400).json({ success: false, message: "Insufficient balance to withdraw" })

    const updated = await Driver.findByIdAndUpdate(
      driverId,
      { $inc: { "earnings.availableToWithdraw": -amount } },
      { new: true, select: "earnings" },
    ).lean()

    return res.json({
      success: true,
      message: "Withdrawal requested",
      data: { earnings: updated?.earnings || {} },
    })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}
