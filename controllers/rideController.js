const Driver = require("../models/driver");
const Vehicle = require("../models/vehicle.js");
const Ride = require("../models/ride");
const GoogleMapsService = require("../utils/googleMapsService");
const{generateOTP} = require("../utils/helpers.js");
const rideService = require("../utils/services.js");
const { sendMessageToSocketId } = require("../socket.js");


// FIND NEARBY DRIVERS

exports.findDriverNearBy = async (req, res) => {
  try {
    const {latitude,longitude,radius = 5000,serviceType,vehicleType,destinationLat,destinationLng} = req.query;

    if (!latitude || !longitude || !serviceType || !destinationLat ||!destinationLng) {
      return res.status(400).json({message:"latitude, longitude, serviceType, destinationLat, and destinationLng are required"});
    }

    const drivers = await Driver.find({
      location: { $near: { $geometry: { type: "Point", coordinates: [Number.parseFloat(longitude), Number.parseFloat(latitude)] }} },
      status: "online",
      "availability.isAvailable": true,
      services: serviceType,
    })
      .limit(20)
      .lean();

    if (!drivers.length) return res.status(404).json({success:false, message:"Drivers are not available in this range", data:[]});

    const driverIds = drivers.map((d) => d._id);
    const vehicles = await Vehicle.find({ driver: { $in: driverIds } }).lean();

    const fareRates = {
      bike: { base: 20, perKm: 8, perMin: 1, surge: 1.0 },
      auto: { base: 30, perKm: 12, perMin: 1.5, surge: 1.0 },
      car: { base: 50, perKm: 15, perMin: 2, surge: 1.0 },
      truck: { base: 80, perKm: 25, perMin: 3, surge: 1.0 },
    };

    const driverResults = await Promise.all(drivers.map(async (driver) => {
        const vehicle = vehicles.find((v) => v.driver.toString() === driver._id.toString());
        if (vehicleType && vehicle?.vehicle?.type !== vehicleType) return null;

        let etaData = null;
        try {
          etaData = await GoogleMapsService.calculateDistance(
            {lat: driver.location.coordinates[1],lng: driver.location.coordinates[0]},
            { lat: Number.parseFloat(latitude), lng: Number.parseFloat(longitude) },
            "driving"
          );
        } catch (err) {
          console.warn("ETA calculation failed for driver:",driver._id,err.message);
        }

        let fareEstimate = null;
        try {
          const distData = await GoogleMapsService.calculateDistance(
            { lat: Number.parseFloat(latitude), lng: Number.parseFloat(longitude) },
            {lat: Number.parseFloat(destinationLat),lng: Number.parseFloat(destinationLng)},
            "driving"
          );

          const distanceKm = distData.distance.value / 1000;
          const durationMin = distData.duration.value / 60;
          const rate = fareRates[vehicleType || "auto"];
          fareEstimate = Math.round((rate.base + distanceKm * rate.perKm + durationMin * rate.perMin) * rate.surge);
        } catch (err) {
          console.warn("Fare calculation failed for driver:",driver._id,err.message);
        }

        return {
          _id: driver._id,
          name: driver.name,
          phone: driver.phone,
          profileImage: driver.profileImage,
          rating: driver.rating,
          location: {lat: driver.location.coordinates[1],lng: driver.location.coordinates[0],address: driver.location.address},
          vehicle: vehicle?.vehicle || null,
          vehicleVerification: vehicle?.verificationStatus || "pending",
          estimatedFare: fareEstimate,
        eta: etaData ? { text: etaData.duration.text, value: etaData.duration.value, minutes: Math.ceil(etaData.duration.value / 60) } : null,
        };
    }));

    res.json(driverResults.filter(Boolean));
  } catch (error) {
    console.error("Error fetching nearby drivers:", error);
    res.status(500).json({ message: "Failed to fetch nearby drivers" });
  }
};

// REQUEST RIDE

exports.createRide = async (req, res) => {
  try {
    const { pickup, destination, vehicleType, serviceType = "ride", offeredFare, paymentMethod = "cash", userId, rideNotes } = req.body;
    if (!pickup || !destination || !vehicleType || !userId) {
      return res.status(400).json({ success: false, message: "Pickup, destination, vehicle type, and userId are required" });
    }
      const driver = await Driver.findById(driverId);
    if (!driver || !driver.availability.isAvailable || driver.status !== "online") return res.status(400).json({ success: false, message: "Driver is no longer available" });

    let distanceData, estimatedFare, distance, duration;
    try {
      distanceData = await GoogleMapsService.calculateDistance({ lat: pickup.latitude, lng: pickup.longitude }, { lat: destination.latitude, lng: destination.longitude }, "driving");
      distance = distanceData.distance.value / 1000;
      duration = distanceData.duration.value / 60;

      const fareRates = { bike: { base: 20, perKm: 8 }, auto: { base: 30, perKm: 12 }, car: { base: 50, perKm: 15 },truck: { base: 80, perKm: 25 }};

      const rate = fareRates[vehicleType] || fareRates.auto;
      estimatedFare = Math.round(rate.base + distance * rate.perKm);
    } catch (error) {
      // fallback values if Maps fails
      distance = 5; duration = 15;
      estimatedFare = vehicleType === "bike" ? 60 : vehicleType === "auto" ? 80 : vehicleType === "car" ? 120 : 180
    }

    let routeInfo = { polyline: null, totalDistanceMeters: null, totalDurationSec: null, waypoints: [] }
    try {
      routeInfo = await GoogleMapsService.getDirections(
        { lat: pickup.latitude, lng: pickup.longitude },
        { lat: destination.latitude, lng: destination.longitude },
        "driving",
      )
    } catch (_) {
      // best-effort, proceed without route
    }

    const rideDoc = {
      user: userId,
      pickup: {
        address: distanceData?.origin_addresses,
        coordinates: {
           latitude: pickup.latitude, 
           longitude: pickup.longitude, 
          },
      },
      destination: {
        address: distanceData?.destination_addresses,
        coordinates: {
           latitude: destination.latitude,
            longitude: destination.longitude, 
          },
      },
      serviceType,
      vehicleType,
      fare: { estimated: estimatedFare, offered: offeredFare || estimatedFare, final: null },
      distance: { estimated: Math.round(distance * 100) / 100 },
      duration: { estimated: Math.ceil(duration) },
      paymentMethod,
      rideNotes: rideNotes || "",
      status: "requested",
      OTPForStartRide: Math.floor(1000 + Math.random() * 9000),
      route: routeInfo?.waypoints?.length
        ? {
            polyline: routeInfo.polyline,
            totalDistanceMeters: routeInfo.totalDistanceMeters,
            totalDurationSec: routeInfo.totalDurationSec,
            waypoints: routeInfo.waypoints,
          }
        : undefined,
    }

    const rideCreated = await Ride.create(rideDoc)
    return res
    .status(201)
    .json({
      success: true,
      message: "Ride requested successfully",
      data: {
        rideId: rideCreated._id,
        status: rideCreated.status,
        OTPForStartRide: rideCreated.OTPForStartRide,
        driver: null,
        pickup: rideCreated.pickup,
        destination: rideCreated.destination,
        fare: rideCreated.fare,
        distance: rideCreated.distance,
        duration: rideCreated.duration,
        estimatedArrival: null,
      },
    });
  } catch (error) {
    console.error("Ride request error:", error.message);
    res.status(500).json({ success: false, message: "Failed to request ride" });
  }
};

// GET ACTIVE RIDE(After create the ride)

exports.activeRide = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, message: "UserId is required" });

    const activeRide = await Ride.findOne({ user: userId,status: { $in: ["requested", "accepted", "driver_assigned", "pickup", "in_progress"] }
    })
      .populate("driver", "name phone vehicle location rating profileImage")
      .sort({ createdAt: -1 });

    if (!activeRide) return res.json({ success: true, data: null, message: "No active ride found" });

    let driverETA = null;
    if (["accepted", "driver_assigned"].includes(activeRide.status) && activeRide.driver?.location?.coordinates) {
      try {
        const [lng, lat] = activeRide.driver.location.coordinates;
        const etaData = await GoogleMapsService.calculateDistance({ lat, lng }, { lat: activeRide.pickup.coordinates.latitude, lng: activeRide.pickup.coordinates.longitude }, "driving");
        driverETA = { text: etaData.duration.text, value: etaData.duration.value, minutes: Math.ceil(etaData.duration.value / 60) };
      } catch (error) { console.warn("Failed to calculate driver ETA:", error.message); }
    }

    return res.json({ success: true, data: { rideId: activeRide._id, status: activeRide.status, driver: activeRide.driver, pickup: activeRide.pickup, destination: activeRide.destination, fare: activeRide.fare, distance: activeRide.distance, duration: activeRide.duration, paymentMethod: activeRide.paymentMethod, driverETA } });
  } catch (error) {
    console.error("Get active ride error:", error);
    res.status(500).json({ success: false, message: "Failed to get active ride" });
    
    // Confirm Ride
    
    exports.acceptedRideByDriver = async (req, res) => {
      try {
        const rideId = req.params.rideId;
        const { driverId, socketId } = req.body; //socketid of user for sending ride confired msg
        if (!rideId || !driverId)
          return res
            .status(400)
            .json({
              status: false,
              message: "Ride d and Driver Id both are required",
            });
    
        //  console.log(req.body,"===ride id ====>",rideId)
        const rideConfirmed = await Ride.findOneAndUpdate(
          { _id: rideId, driver: driverId, status: "requested" },
          { status: "accepted" },
          { new: true }
        ).populate("user", "_id socketId");
    
        if (!rideConfirmed)
          return res.status(404).json({ status: false, message: "Ride not found" });
        if (socketId) {
          sendMessageToSocketId(socketId, {
            event: "ride-confirmed",
            data: rideConfirmed,
          });
        } else {
          sendMessageToSocketId(rideConfirmed.user.socketId, {
            event: "ride-confirmed",
            data: rideConfirmed,
          });
        }
    
        return res.status(200).json({success:true, data:rideConfirmed});
      } catch (err) {
        console.log(err);
        return res.status(500).json({ message: err.message });
      }
    };
    //Start ride after getting confirmation with Driver using otp
    
    exports.startRide = async (req, res) => {
      try {
        const { rideId, otp, driverId, socketId } = req.body;
        const ride = await rideService.startRide({ rideId, otp, driverId });
    
        console.log(ride);
    
        if (socketId) {
          // If client provided socketId, send message to that socket
          sendMessageToSocketId(socketId, {
            event: "ride-started",
            data: ride,
          });
        } else {
          // Otherwise, notify the user’s socket
          sendMessageToSocketId(ride.user.socketId, {
            event: "ride-started",
            data: ride,
          });
        }
    
        // Extract fields safely
        const {
          pickup,
          destination,
          fare,
          distance,
          duration,
          status,
          user,
          vehicleType,
          serviceType,
          paymentMethod,
          paymentStatus,
          driver,
        } = ride;
    
        return res.status(200).json({
          success: true,
          data: {
            pickup,
            destination,
            fare,
            distance,
            duration,
            status,
            user,
            vehicleType,
            serviceType,
            paymentMethod,
            paymentStatus,
            driver,
          },
        });
      } catch (err) {
        console.error(err);
        return res.status(500).json({ message: err.message });
      }
    };
    
  }
};

// CANCEL RIDE

exports.cancelRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { reason, userId } = req.body;

    const ride = await Ride.findById(rideId);
    if (!ride) return res.status(404).json({ success: false, message: "Ride not found" });
    if (ride.user.toString() !== userId) return res.status(403).json({ success: false, message: "Unauthorized" });

    const cancellableStatuses = ["requested", "accepted", "driver_assigned"];
    if (!cancellableStatuses.includes(ride.status)) return res.status(400).json({ success: false, message: "Ride cannot be cancelled now" });

    const canceledRide = await Ride.findByIdAndUpdate(
      { _id: rideId },
      {
        $set: {
          status: "cancelled",
          cancellationReason: reason,
          "timeline.cancelledAt": new Date()
        }
      },
      { new: true }
    );

    if (canceledRide.driver)
      await Driver.findByIdAndUpdate(canceledRide.driver, {
        "availability.isAvailable": true,
      });

    return res.status(200).json({
      success: true,
      message: "Ride cancelled",
      data: {
        rideId: canceledRide._id,
        status: canceledRide.status,
        cancellationFee: canceledRide.cancellationFee,
      },
    });
  } catch (error) {
    console.error("Cancel ride error:", error);
    res.status(500).json({ success: false, message: "Failed to cancel ride" });
  }
};

// COMPLETE RIDE

exports.rideCompleted = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { userId, paymentMethod } = req.body;

    const ride = await Ride.findOne({
      _id: rideId,
      status: { $nin: ["cancelled", "completed"] }
    });
    if (!ride)
      return res
        .status(404)
        .json({ success: false, message: "Ride not found" });

    if (ride.user.toString() !== userId)
       return res.status(403).json({ success: false, message: "Unauthorized" });

    const finalPaymentMethod = paymentMethod || "cash"

    const completedRide = await Ride.findByIdAndUpdate(
      { _id: rideId},
      {
        $set: {
          status: "completed",
          paymentStatus: "paid",
          paymentMethod: finalPaymentMethod,
          "timeline.completedAt": new Date()
        }
      },
      { new: true }
    );

    
    if (completedRide.driver)
      await Driver.findByIdAndUpdate(completedRide.driver, {
        "availability.isAvailable": true,
      });

    return res.status(200).json({
      success: true,
      message: "Ride has completed successfully",
      data: {
        rideId: completedRide._id,
        status: completedRide.status
      }
    });
  } catch (error) {
    console.error("Ride completion error:", error)
    res.status(500).json({ success: false, message: "Failed to complete ride" })
  }
};

// GIVE Rating

exports.rating = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { userId, userRating,
       driverRating,
        userComment,
         driverComment } = req.body;

    if(!rideId || !userId) return res.status(400).json({success: false,
       message: "Ride id and user id both are required"})

    const ride = await Ride.findOne({
      _id: rideId,
      status: "completed"
    });
    if (!ride) 
      return res
    .status(404)
    .json({ success: false, message: "Ride not found" });

    if (ride.user.toString() !== userId)
       return res.status(403).json({ success: false, message: "Unauthorized" });

    const ratingForRide = await Ride.findByIdAndUpdate(
      rideId,
      {
        $set: {
          "rating.userRating": Number(userRating),
          "rating.driverRating": driverRating ? Number(driverRating) : 0,
          "rating.userComment": userComment ? userComment : "",
          "rating.driverComment": driverComment ? driverComment : ""
        }
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Thank you for Rating!",
      data: {
        rideId: ratingForRide._id,
        status: ratingForRide.status,
        userRating: ratingForRide.rating.userRating,
        driverRating: ratingForRide.rating.driverRating,
        userComment: ratingForRide.rating.userComment,
        driverComment: ratingForRide.rating.driverComment
      }
    });
  } catch (error) {
    console.error("Rating error:", error);
    res.status(500).json({ success: false, message: "Failed to rate ride" });
  }
}

exports.getRideHistory = async (req, res) => {
  try {
    const { userId, page = 1, limit = 10, status } = req.query;
    if (!userId) return res.status(400).json({ success: false, message: "UserId is required" });

    const query = { user: userId };
    if (status) query.status = status; else query.status = { $in: ["completed", "cancelled"] };

    const skip = (Number.parseInt(page) - 1) * Number.parseInt(limit);
    const rides = await Ride.find(query).populate("driver", "name phone vehicle rating").sort({ createdAt: -1 }).skip(skip).limit(Number.parseInt(limit));
    const totalRides = await Ride.countDocuments(query);

    const ridesWithDetails = rides.map((ride) => ({
      rideId: ride._id,
      status: ride.status,
      driver: ride.driver,
      pickup: ride.pickup,
      destination: ride.destination,
      fare: { final: ride.fare.final || ride.fare.offered, paymentMethod: ride.paymentMethod },
      distance: ride.distance,
      duration: ride.duration,
      date: ride.createdAt,
      completedAt: ride.timeline?.completedAt || null,
      cancelledAt: ride.timeline?.cancelledAt || null,
    }))

    res.json({ success: true, data: { rides: ridesWithDetails, pagination: { currentPage: Number.parseInt(page), totalPages: Math.ceil(totalRides / Number.parseInt(limit)), totalRides } } });
  } catch (error) {
    console.error("Get ride history error:", error);
    res.status(500).json({ success: false, message: "Failed to get ride history" });
  }
};