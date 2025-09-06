const Service = require("../models/service.js");
const Driver = require("../models/driver.js");

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

exports.driverServices = async (req, res) => {
  try {
    const { services } = req.body;
    const driverId = req.user._id;

    if (!services || !Array.isArray(services)) {
      return res.status(400).json({
        success: false,
        message: "Please provide services as an array",
      });
    }
    
    const serviceMapping = {
      ride: "ride",
      courier: "delivery",
      freight: "freight",
    };

    const mappedServices = services.map(service => serviceMapping[service] || service);
  
    const allowedServices = ["ride", "delivery", "freight"];
    const invalidServices = mappedServices.filter(service => !allowedServices.includes(service));
    
    if (invalidServices.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid services: ${invalidServices.join(", ")}. Allowed services are: ${allowedServices.join(", ")}`,
      });
    }

    const updatedDriver = await Driver.findByIdAndUpdate(
      driverId,
      { $set: { services: mappedServices } },
      { new: true, runValidators: true }
    ).select("_id name email phone services");

    if (!updatedDriver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Driver services registered successfully",
    });
  } catch (err) {
    console.error("Error registering driver services:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while registering driver services",
    });
  }
};
