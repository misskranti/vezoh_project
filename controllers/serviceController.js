const Service = require("../models/service.js");

exports.addServices = async (req, res) => {
  try {
    await Service.deleteMany({});
    const insertedServices = await Service.insertMany(req.body.services);
    return res.status(201).json({
      success: true,
      message: "Services added successfully",
      data: insertedServices,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Server error while adding services",
    });
  }
};

exports.servicesList = async (req, res) => {
  try {
    const services = await Service.find({ active: true })
      .sort({ createdAt: 1 })
      .select("-__v -createdAt -updatedAt");

    return res.status(200).json({
      success: true,
      message: services.length
        ? "Available Services"
        : "Services not available",
      data: services,
    });
  } catch (error) {
    console.error("Error fetching services:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch services",
    });
  }
};

exports.particularService = async (req, res) => {
  try {
    const { service } = req.params;

    const serviceDetail = await Service.findOne({
      service: service,
      active: true,
    }).select("-__v -createdAt -updatedAt");

    if (!serviceDetail) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    return res.json({
      success: true,
      message: "Service Details",
      data: serviceDetail,
    });
  } catch (error) {
    console.error("Error fetching service details:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch service details",
    });
  }
};
