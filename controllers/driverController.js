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
// ----------------------- Driver Vehicle Registration (Need to be Update Kaya)----------------------//
exports.vehicleRegistration = async (req, res) => {
  try {
    // // Debug: Log request data
    // console.log("Request body:", req.body);
    // console.log("Request files:", req.files);
    // console.log("Request file keys:", req.files ? Object.keys(req.files) : "No files");

    const { driverId, vehicleType, vehicleNumber, ownerName } = req.body;

    if (!driverId || !vehicleType || !vehicleNumber || !ownerName) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide driverId, vehicle type, vehicle number, and owner name",
      });
    }

    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    if (!driver.isVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify OTP before submitting vehicle details",
      });
    }

    const existingVehicle = await Vehicle.findOne({
      "vehicle.plateNumber": vehicleNumber.toUpperCase(),
    });
    if (existingVehicle) {
      return res.status(400).json({
        success: false,
        message: "Vehicle with this number is already registered",
      });
    }

    // Check if driver already has a vehicle registered
    const driverVehicle = await Vehicle.findOne({ driver: driverId });
    if (driverVehicle) {
      return res.status(400).json({
        success: false,
        message: "Driver already has a vehicle registered",
      });
    }

    // Debug file upload
    console.log("Checking files...");
    if (!req.files) {
      return res.status(400).json({
        success: false,
        message: "No files uploaded",
      });
    }

    const requiredFiles = [
      "drivingLicense",
      "rcCertificate",
      "vehicleInsurance",
    ];

    // // More detailed file checking with debug info
    // const missingFiles = [];
    // const availableFiles = [];

    // requiredFiles.forEach(field => {
    //   if (!req.files[field] || !req.files[field][0]) {
    //     missingFiles.push(field);
    //   } else {
    //     availableFiles.push(field);
    //     console.log(`File ${field} found:`, req.files[field][0].filename);
    //   }
    // });

    // console.log("Available files:", availableFiles);
    // console.log("Missing files:", missingFiles);

       const missingFiles = requiredFiles.filter((field) => !req.files?.[field]);
       if (missingFiles.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Please upload all required documents",
        missingFiles,
        // availableFiles, // Add this for debugging
        // debug: {
        //   totalFilesReceived: Object.keys(req.files).length,
        //   fileFields: Object.keys(req.files)
        // }
      });
    }

    // Create Vehicle document instead of updating Driver
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
      //verificationStatus: "pending",
    });

    await newVehicle.save();

    // Update driver status
    driver.registrationStep = "vehicle-submitted";
    driver.verificationStatus = "pending";

    await driver.save();

    res.status(200).json({
      success: true,
      message: "Vehicle details submitted successfully",
      // data: {
      //   vehicleId: newVehicle._id.toString(),
      //   driver: {
      //     id: driver._id.toString(),
      //     registrationStep: driver.registrationStep,
      //   },
      //   vehicle: {
      //     type: newVehicle.vehicle.type,
      //     plateNumber: newVehicle.vehicle.plateNumber,
      //     ownerName: newVehicle.ownerName,
      //   },
      // },
    });
  } catch (error) {
    console.error("Vehicle registration error:", error);

     if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: validationErrors,
      });
    }

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: "Invalid driver ID format",
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate entry found",
      });
    }

    res.status(500).json({
      success: false,
      message: "Vehicle registration failed. Please try again.",
    });
  }
};
