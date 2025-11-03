const { validationResult } = require("express-validator");
const Driver = require("../models/driver");
const Vehicle = require("../models/vehicle.js");
const Ride = require("../models/ride");
const GoogleMapsService = require("../utils/googleMapsService");
const { generateOTP } = require("../utils/helpers.js");
const rideService = require("../utils/services.js");
const { sendMessageToSocketId } = require("../socket.js");

// FIND NEARBY DRIVERS

exports.findDriverNearBy = async (req, res) => {
  try {
    const {
      latitude,
      longitude,
      radius = 5000,
      serviceType,
      vehicleType,
      destinationLat,
      destinationLng,
    } = req.query;

    if (
      !latitude ||
      !longitude ||
      !serviceType ||
      !destinationLat ||
      !destinationLng
    ) {
      return res
        .status(400)
        .json({
          message:
            "latitude, longitude, serviceType, destinationLat, and destinationLng are required",
        });
    }

    const drivers = await Driver.find({
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          },
        },
      },
      status: "online",
      "availability.isAvailable": true,
      services: serviceType,
    })
      .limit(20)
      .lean();

    if (!drivers.length)
      return res
        .status(404)
        .json({
          success: false,
          message: "Drivers are not available in this range",
          data: [],
        });

    const driverIds = drivers.map((d) => d._id);
    const vehicles = await Vehicle.find({ driver: { $in: driverIds } }).lean();

    const fareRates = {
      bike: { base: 20, perKm: 8, perMin: 1, surge: 1.0 },
      auto: { base: 30, perKm: 12, perMin: 1.5, surge: 1.0 },
      car: { base: 50, perKm: 15, perMin: 2, surge: 1.0 },
    };

    const driverResults = await Promise.all(
      drivers.map(async (driver) => {
        const vehicle = vehicles.find(
          (v) => v.driver.toString() === driver._id.toString()
        );
        if (vehicleType && vehicle?.vehicle?.type !== vehicleType) return null;

        let etaData = null;
        try {
          etaData = await GoogleMapsService.calculateDistance(
            {
              lat: driver.location.coordinates[1],
              lng: driver.location.coordinates[0],
            },
            { lat: parseFloat(latitude), lng: parseFloat(longitude) },
            "driving"
          );
        } catch (err) {
          console.warn(
            "ETA calculation failed for driver:",
            driver._id,
            err.message
          );
        }

        let fareEstimate = null;
        try {
          const distData = await GoogleMapsService.calculateDistance(
            { lat: parseFloat(latitude), lng: parseFloat(longitude) },
            {
              lat: parseFloat(destinationLat),
              lng: parseFloat(destinationLng),
            },
            "driving"
          );

          const distanceKm = distData.distance.value / 1000;
          const durationMin = distData.duration.value / 60;
          const rate = fareRates[vehicleType || "auto"];
          fareEstimate = Math.round(
            (rate.base + distanceKm * rate.perKm + durationMin * rate.perMin) *
              rate.surge
          );
        } catch (err) {
          console.warn(
            "Fare calculation failed for driver:",
            driver._id,
            err.message
          );
        }

        return {
          _id: driver._id,
          name: driver.name,
          phone: driver.phone,
          profileImage: driver.profileImage,
          rating: driver.rating,
          location: {
            lat: driver.location.coordinates[1],
            lng: driver.location.coordinates[0],
            address: driver.location.address,
          },
          vehicle: vehicle?.vehicle || null,
          vehicleVerification: vehicle?.verificationStatus, //|| "pending",
          estimatedFare: fareEstimate,
          eta: etaData
            ? {
                text: etaData.duration.text,
                value: etaData.duration.value,
                minutes: Math.ceil(etaData.duration.value / 60),
              }
            : null,
        };
      })
    );

    res.json(driverResults.filter(Boolean));
  } catch (error) {
    console.error("Error fetching nearby drivers:", error);
    res.status(500).json({ message: "Failed to fetch nearby drivers" });
  }
};

// REQUEST RIDE

exports.createRide = async (req, res) => {
  try {
    const {
      pickup,
      destination,
      driverId,
      vehicleType,
      serviceType = "ride",
      offeredFare,
      paymentMethod = "cash",
      userId,
      rideNotes,
    } = req.body;
    if (!pickup || !destination || !driverId || !vehicleType || !userId)
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Pickup, destination, driver, vehicle type, and userId are required",
        });

    const driver = await Driver.findById(driverId);
    if (
      !driver ||
      !driver.availability.isAvailable ||
      driver.status !== "online"
    )
      return res
        .status(400)
        .json({ success: false, message: "Driver is no longer available" });

    let distanceData, estimatedFare, distance, duration;
    try {
      distanceData = await GoogleMapsService.calculateDistance(
        { lat: pickup.latitude, lng: pickup.longitude },
        { lat: destination.latitude, lng: destination.longitude },
        "driving"
      );
      distance = distanceData.distance.value / 1000;
      duration = distanceData.duration.value / 60;

      const fareRates = {
        bike: { base: 20, perKm: 8 },
        auto: { base: 30, perKm: 12 },
        car: { base: 50, perKm: 15 },
      };
      const rate = fareRates[vehicleType] || fareRates.auto;
      estimatedFare = Math.round(rate.base + distance * rate.perKm);
    } catch (error) {
      distance = 5;
      duration = 15;
      estimatedFare =
        vehicleType === "bike" ? 60 : vehicleType === "auto" ? 80 : 120;
    }

    const ride = new Ride({
      user: userId,
      driver: driverId,
      pickup: {
        address: distanceData.origin_addresses,
        coordinates: {
          latitude: pickup.latitude,
          longitude: pickup.longitude,
        },
      },
      destination: {
        address: distanceData.destination_addresses,
        coordinates: {
          latitude: destination.latitude,
          longitude: destination.longitude,
        },
      },
      serviceType,
      vehicleType,
      fare: {
        estimated: estimatedFare,
        offered: offeredFare || estimatedFare,
        final: null,
      },
      distance: {
        estimated: Math.round(distance * 100) / 100,
        text: distanceData?.distance.text || `${Math.round(distance)} km`,
        value: distanceData?.distance.value || Math.round(distance * 1000),
      },
      duration: {
        estimated: Math.ceil(duration),
        text: distanceData?.duration.text || `${Math.ceil(duration)} min`,
        value: distanceData?.duration.value || Math.ceil(duration * 60),
      },
      paymentMethod,
      rideNotes: rideNotes || "",
      status: "requested",
      OTPForStartRide: Math.floor(1000 + Math.random() * 9000),
       rating: {
      userRating: 0,
      driverRating: 0,
      userComment: "",
      driverComment: "",
    }
      // requestedAt: new Date(),
    });
    const rideCreated = await Ride.create(ride);
    await rideCreated.populate("driver", "name phone vehicle rating");
    // not required if driver is not accepted the ride yet
    // // 🔥 Send socket update to driver — new ride request
    // if (driver.socketId) {
    //   sendMessageToSocketId(driver.socketId, {
    //     event: "new-ride-request",
    //     data: {
    //       rideId: rideCreated._id,
    //       pickup: rideCreated.pickup,
    //       destination: rideCreated.destination,
    //       distance: rideCreated.distance,
    //       duration: rideCreated.duration,
    //       fare: rideCreated.fare,
    //     },
    //   });
    // }

    // // 🔥 Optional: also notify user with driver distance
    // // (for simplicity, we’ll just use same distance info)
    // if (rideCreated.user?.socketId) {
    //   sendMessageToSocketId(rideCreated.user.socketId, {
    //     event: "driver-distance",
    //     data: {
    //       driverId: driver._id,
    //       distance: rideCreated.distance,
    //       duration: rideCreated.duration,
    //     },
    //   });
    // }

    return res.status(201).json({
      success: true,
      message: "Ride requested successfully",
      data: {
        rideId: rideCreated._id,
        status: rideCreated.status,
        OTPForStartRide: rideCreated.OTPForStartRide,
        driver: rideCreated.driver,
        pickup: rideCreated.pickup,
        destination: rideCreated.destination,
        fare: rideCreated.fare,
        distance: rideCreated.distance,
        duration: rideCreated.duration,
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
    if (!userId)
      return res
        .status(400)
        .json({ success: false, message: "UserId is required" });

    const activeRide = await Ride.findOne({
      user: userId,
      status: {
        $in: 
        [
        "requested",
        "accepted",
        "driver_assigned",
        "pickup",
        "in_progress",
        "completed",
        "started"
      ]
      },
    })
      .populate("driver", "name phone vehicle location rating profileImage")
      .sort({ createdAt: -1 });

    if (!activeRide)
      return res.json({
        success: true,
        data: null,
        message: "No active ride found",
      });

    let driverETA = null;
    if (
      ["accepted", "arriving"].includes(activeRide.status) &&
      activeRide.driver?.location?.coordinates
    ) {
      try {
        const [lng, lat] = activeRide.driver.location.coordinates;
        const etaData = await GoogleMapsService.calculateDistance(
          { lat, lng },
          { lat: activeRide.pickup.latitude, lng: activeRide.pickup.longitude },
          "driving"
        );
        driverETA = {
          text: etaData.duration.text,
          value: etaData.duration.value,
          minutes: Math.ceil(etaData.duration.value / 60),
        };
      } catch (error) {
        console.warn("Failed to calculate driver ETA:", error.message);
      }
    }

    res.json({
      success: true,
      data: {
        rideId: activeRide._id,
        status: activeRide.status,
        driver: activeRide.driver,
        pickup: activeRide.pickup,
        destination: activeRide.destination,
        fare: activeRide.fare,
        distance: activeRide.distance,
        duration: activeRide.duration,
        paymentMethod: activeRide.paymentMethod,
        driverETA,
      },
    });
  } catch (error) {
    console.error("Get active ride error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to get active ride" });
  }
};

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
      { status: "accepted", "timeline.acceptedAt": new Date() },
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

// CANCEL RIDE

exports.cancelRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { reason, userId } = req.body;

    const ride = await Ride.findById(rideId);
    if (!ride)
      return res
        .status(404)
        .json({ success: false, message: "Ride not found" });
    if (ride.user.toString() !== userId)
      return res.status(403).json({ success: false, message: "Unauthorized" });

    const cancellableStatuses = ["requested", "accepted", "arriving"];
    if (!cancellableStatuses.includes(ride.status))
      return res
        .status(400)
        .json({ success: false, message: "Ride cannot be cancelled now" });

    // const CANCELLATION_FEE = 25;
    // ride.status = "cancelled";
    // ride.cancellationReason = reason;
    // ride.cancellationFee = CANCELLATION_FEE;
    // ride.cancelledAt = new Date();

    const canceledRide = await Ride.findByIdAndUpdate(
      { _id: rideId },
      {
        $set: {
          // cancellationFee: 25,
          status: "cancelled",
          cancellationReason: reason,
          "timeline.cancelledAt": new Date(),
        },
      },
      { new: true }
    );

    // await ride.save();

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
        // refundAmount: Math.max(0, Number(canceledRide.fare.offered) - Number(canceledRide.cancellationFee)), //how can you refund before payment done by user ?
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

    if (!rideId || !userId)
      return res
        .status(400)
        .json({
          success: true,  
          message: "Ride id and user id both are required",  
        });

    const ride = await Ride.findOne({
      _id: rideId,
      status: "started",
    });
    if (!ride)
      return res
        .status(404)
        .json({ success: false, message: "Ride not found Or not started" });

    if (ride.user.toString() !== userId)
      return res.status(403).json({ success: false, message: "Unauthorized" });

    paymentMethod ? paymentMethod : "cash";

    const completedRide = await Ride.findByIdAndUpdate(
      { _id: rideId },
      {
        $set: {
          status: "completed",
          paymentStatus: "paid",
          paymentMethod: paymentMethod,
          "timeline.completedAt": new Date(),
        },
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
        status: completedRide.status,
      },
    });
  } catch (error) {
    console.error("Cancel ride error:", error);
    res.status(500).json({ success: false, message: "Failed to cancel ride" });
  }
};

// GIVE Rating for both user and driver

exports.rating = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { id, rating, comment } = req.body; // id can belong to user or driver

    if (!rideId || !id) {
      return res.status(400).json({
        success: false,
        message: "Ride ID and ID (user/driver) are required",
      });
    }

    const ride = await Ride.findOne({ _id: rideId, status: "completed" });
    if (!ride) {
      return res
        .status(404)
        .json({ success: false, message: "Ride not found or not completed" });
    }

    let updateFields = {};

    // USER gives rating
    if (ride.user.toString() === id.toString()) {

      updateFields["rating.userRating"] = rating ? Number(rating) : 0;
      updateFields["rating.userComment"] = comment ? comment : "";

    }
    // DRIVER gives rating
    else if (ride.driver && ride.driver.toString() === id.toString()) {

      updateFields["rating.driverRating"] = rating ? Number(rating) : 0;
      updateFields["rating.driverComment"] = comment ? comment : "";
    } 
    else {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const updatedRide = await Ride.findByIdAndUpdate(
      rideId,
      { $set: updateFields },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Thank you for your Rating!",
      data: {
        rideId: updatedRide._id,
        status: updatedRide.status}, 
    });
  } catch (error) {
    console.error("Rating error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit rating",
    });
  }
};


exports.getRideHistory = async (req, res) => {
  try {
    const { userId, page = 1, limit = 10, status } = req.query;
    if (!userId)
      return res
        .status(400)
        .json({ success: false, message: "UserId is required" });

    const query = { user: userId };
    if (status) query.status = status;
    else query.status = { $in: ["completed", "cancelled"] };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const rides = await Ride.find(query)
      .populate("driver", "name phone vehicle rating")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    const totalRides = await Ride.countDocuments(query);

    const ridesWithDetails = rides.map((ride) => ({
      rideId: ride._id,
      status: ride.status,
      driver: ride.driver,
      pickup: ride.pickup,
      destination: ride.destination,
      fare: {
        final: ride.fare.final || ride.fare.offered,
        paymentMethod: ride.paymentMethod,
      },
      distance: ride.distance,
      duration: ride.duration,
      date: ride.createdAt,
      completedAt: ride.completedAt,
      cancelledAt: ride.cancelledAt,
    }));

    res.json({
      success: true,
      data: {
        rides: ridesWithDetails,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalRides / parseInt(limit)),
          totalRides,
        },
      },
    });
  } catch (error) {
    console.error("Get ride history error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to get ride history" });
  }
};