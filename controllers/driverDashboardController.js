const Driver = require("../models/driver.js");
const Vehicle = require("../models/vehicle.js");
const Ride = require("../models/ride.js");


//-------------------------- Dashboard Screen -----------------------------------------//
const validateCoordinates = (lat, lng) => {
  const latNum = Number.parseFloat(lat)
  const lngNum = Number.parseFloat(lng)

  if (isNaN(latNum) || isNaN(lngNum)) return null
  if (latNum < -90 || latNum > 90) return null
  if (lngNum < -180 || lngNum > 180) return null

  return { lat: latNum, lng: lngNum }
}

exports.statusUpdate = async (req, res) => {
  try {
    const { action, lat, lon } = req.body;

    const coords = validateCoordinates(lat, lon);
    if (!coords) {
      return res.status(400).json({
        success: false,
        message: "Invalid latitude or longitude values"
      });
    }
  
    let status = action === 1 ? "online" : "offline";

    
    const updateLocation = await Driver.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          "location.type": "Point",
          "location.coordinates": [coords.lng, coords.lat],
          "location.lastUpdated": new Date(),
          status: status,
          "availability.isAvailable": action === 1 ? true : false,
        },
      },
      { new: true }
    );

    if (!updateLocation) {
      return res.status(404).json({
        success: false,
        message: "Driver not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Status updated successfully",
      data: {
        status: updateLocation.status,
        location: {
          lat: updateLocation.location.coordinates[1],
          lng: updateLocation.location.coordinates[0]
        }
      }
    });
  } catch (err) {
    console.error("Status update error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: err?.message,
    });
  }
};

//-------------------------- Dashboard Screen ---------------------------------------------//

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

    const verificationStatus = vehicle?.verificationStatus|| "pending";
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

//-------------------------- Incoming Request Screen ---------------------------------------------//

exports.incomingrequest = async (req, res) => {
  try {
    const { driverId } = req.params;

    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).json({ success: false, message: "Driver not found" });
    }

    if (driver.status !== "online") {
      return res.status(400).json({ success: false, message: "Driver is not online" });
    }

    const rides = await Ride.find({
      status: "requested",
      serviceType: { $in: driver.services },
      "pickup.coordinates": {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: driver.location.coordinates,
          },
          $maxDistance: 5000,
        },
      },
    })
      .populate("user", "name phone profileImage")
      .lean();

    res.json({ success: true, rides });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};