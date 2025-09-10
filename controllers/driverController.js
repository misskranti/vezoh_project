const Driver = require("../models/driver.js");
const Vehicle = require("../models/vehicle.js");

//-------------------------- Driver Opt Services -----------------------------------------//
exports.driverOptServices = async (req, res) => {
  try {
    const { services } = req.body;
    const driverId = req.user._id;

    const updatedDriver = await Driver.findByIdAndUpdate(
      driverId,
      { $set: { services: services } },
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

//--------------------------Selected Services---------------------------------------------//
exports.selectedServices = async (req, res) => {
  try {
    const fetchDetails = await Vehicle.findOne({ driver: req.user._id }).select(
      { verificationStatus: 1, driver: 1 }
    );
    //   .populate("driver", "_id services"); // No need because driver's whole document is stored in req object

    return res.status(200).json({
      success: true,
      message: "Driver Selected Services",
      data: {
        verificationStatus: fetchDetails?.verificationStatus || "pending",
        services: req.user.services,
        serviceStatus:
          fetchDetails && fetchDetails?.verificationStatus === "approved"
            ? "active"
            : "pending",
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false.valueOf,
      message: "Server error while fetching selected services",
    });
  }
};
// ----------------------- Driver Vehicle Registration------------------------------------//
exports.vehicleRegistration = async (req, res) => {
  try {
        const { driverId, vehicleType, vehicleNumber, ownerName } = req.body;

    // Validate required fields
    if (!driverId || !vehicleType || !vehicleNumber || !ownerName) {
      return res.status(400).json({
        success: false,
        message: "Please provide driverId, vehicle type, vehicle number, and owner name",
      });
    }

    // Check if driver exists
    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).json({ success: false, message: "Driver not found" });
    }

    if (!driver.isVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify OTP before submitting vehicle details",
      });
    }

    // Check for existing vehicle number
    const existingVehicle = await Vehicle.findOne({
      "vehicle.plateNumber": vehicleNumber.toUpperCase(),
    });
    if (existingVehicle) {
      return res.status(400).json({
        success: false,
        message: "Vehicle with this number is already registered",
      });
    }

    // Check if driver already has a vehicle
    const driverVehicle = await Vehicle.findOne({ driver: driverId });
    if (driverVehicle) {
      return res.status(400).json({
        success: false,
        message: "Driver already has a vehicle registered",
      });
    }

    // Validate uploaded files
    const requiredFiles = ["drivingLicense", "rcCertificate", "vehicleInsurance"];
    const missingFiles = requiredFiles.filter((field) => !req.files?.[field]);
    if (missingFiles.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Please upload all required documents",
        missingFiles,
      });
    }

    // Create new vehicle document
    const newVehicle = new Vehicle({
      driver: driverId,
      vehicle: {
      type: vehicleType.toLowerCase(),
        plateNumber: vehicleNumber.toUpperCase(),
      },
      ownerName: ownerName.trim(),
      documents: {
      drivingLicense: {
          frontImage: req.files.drivingLicense[0].path,
        isVerified: false,
      },
        vehicleRegistration: {
        image: req.files.rcCertificate[0].path,
        isVerified: false,
      },
        insurance: {
        image: req.files.vehicleInsurance[0].path,
        isVerified: false,
      },
      },
    });

    await newVehicle.save();

    // Update driver
    driver.registrationStep = "vehicle-submitted";
    driver.verificationStatus = "pending";
    await driver.save();

    res.status(200).json({
      success: true,
      message: "Vehicle details submitted successfully",
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({ success: false, message: "Validation error", errors: validationErrors });
    }

    if (error.name === "CastError") {
      return res.status(400).json({ success: false, message: "Invalid driver ID format" });
    }

    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "Duplicate entry found" });
    }

    res.status(500).json({
      success: false,
      message: "Vehicle registration failed. Please try again.",
    });
  }
};
