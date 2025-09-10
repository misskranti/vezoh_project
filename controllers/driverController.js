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


