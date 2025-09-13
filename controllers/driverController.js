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

//-------------------------- Driver Online/Offline Status Update -----------------------------------------//
exports.statusUpdate = async (req, res) => {
  try {
    const { action, lat, lon } = req.body;

    let status;
    switch (+action) {
      case 0:
        status = "offline";
        break;
      case 1:
        status = "online";
        break;
    }

    const updateLocation = await Driver.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          "location.coordinates": {
            latitude: lat,
            longitude: lon,
          },
          status: status,
        },
      },
      { new: true }
    );
    return res.status(201).json({
      success: true,
      message: "Status updated successfully",
      // data: updateLocation,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: err?.message,
    });
  }
};

//--------------------------Driver Dashboard---------------------------------------------//

exports.driverdashboard = async (req, res) => {
  try {
    const driverId = req.user.id;

    const driver = await Driver.findById(driverId)
      .select("services earnings.today stats.completedTrips")
      .lean();

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    const vehicle = await Vehicle.findOne({ driver: driverId })
      .select("vehicle verificationStatus")
      .lean(); 

    const verificationStatus = vehicle?.verificationStatus || "pending";
    const servicestatus =
      verificationStatus === "approved" ? "active" : "pending";

    const vehicleData = vehicle
      ? {
          type: vehicle.vehicle?.type || "",
          platenumber: vehicle.vehicle?.plateNumber || "",
          servicestatus: servicestatus, 
        }
      : {
          type: "",
          platenumber: "",
          servicestatus: "pending",
        };

    const responseData = {
        todaysearning: driver.earnings?.today || 0,
        completedtrips: driver.stats?.completedTrips || 0,
      services: driver.services || [],
      ...vehicleData, 
    };

    return res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (err) {
    console.error("Driver Dashboard Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching dashboard",
    });
  }
};
