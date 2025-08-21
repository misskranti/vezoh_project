const express = require("express")
const router = express.Router()
const auth = require("../middleware/auth")
const Service = require("../models/service")

router.get("/", async (req, res) => {
  try {
    const services = await Service.find({ active: true })
      .sort({ sortOrder: 1, createdAt: 1 })
      .select("-__v -createdAt -updatedAt")

    res.json({
      success: true,
      data: services,
    })
  } catch (error) {
    console.error("Error fetching services:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch services",
    })
  }
})

router.get("/:serviceId", async (req, res) => {
  try {
    const { serviceId } = req.params

    const service = await Service.findOne({
      serviceId: serviceId,
      active: true,
    }).select("-__v -createdAt -updatedAt")

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      })
    }

    res.json({
      success: true,
      data: service,
    })
  } catch (error) {
    console.error("Error fetching service details:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch service details",
    })
  }
})

module.exports = router
