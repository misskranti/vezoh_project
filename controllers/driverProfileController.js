const Driver = require("../models/driver")
const Vehicle = require("../models/vehicle")

exports.getProfileSummary = async (req, res) => {
  try {
    const driverId = req.user._id

    const [driver, vehicle] = await Promise.all([
      Driver.findById(driverId).select("name phone profileImage rating average status stats.totalTrips").lean(),
      Vehicle.findOne({ driver: driverId }).select("verificationStatus").lean(),
    ])

    if (!driver) {
      return res.status(404).json({ success: false, message: "Driver not found" })
    }

    const verificationStatus = vehicle?.verificationStatus || "pending"
    const statusLabel = verificationStatus === "approved" ? "Active" : "Pending"

    return res.json({
      success: true,
      data: {
        name: driver.name,
        phone: driver.phone,
        avatar: driver.profileImage || null,
        rating: {
          average: driver?.rating?.average ?? 5.0,
          count: driver?.rating?.count ?? 0,
        },
        status: driver.status,
        statusLabel,
        tripsCount: driver?.stats?.totalTrips ?? 0,
      },
    })
  } catch (err) {
    console.error("[driverProfileController.getProfileSummary] error:", err)
    return res.status(500).json({ success: false, message: "Failed to fetch profile summary" })
  }
}
