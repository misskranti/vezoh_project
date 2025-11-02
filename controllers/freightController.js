const { validationResult } = require("express-validator");
const Driver = require("../models/driver.js");
const Vehicle = require("../models/vehicle.js");
const Ride = require("../models/ride.js");
const GoogleMapsService = require("../utils/googleMapsService.js");
const { generateOTP } = require("../utils/helpers.js");
// const rideService = require("../utils/services.js");
const { sendMessageToSocketId } = require("../socket.js");
const { sendEmailVerificationOTP } = require("../utils/emailService.js");
const driver = require("../models/driver.js");

// FIND NEARBY DRIVERS FOR GOODS  (["minitruck", "truck"])
exports.findDriverNearByForFreight = async (req, res) => {
  try {
    const {latitude,longitude,radius = 5000,serviceType,vehicleType,destinationLat,destinationLng} = req.query;

    if (!latitude || !longitude || !serviceType || !destinationLat ||!destinationLng) {
      return res.status(400).json({message:"latitude, longitude, serviceType, destinationLat, and destinationLng are required"});
    }

    const userCoords = validateCoordinates(latitude, longitude)
    const destCoords = validateCoordinates(destinationLat, destinationLng)

    if (!userCoords || !destCoords) {
      return res.status(400).json({ success: false, message: "Invalid latitude or longitude values" })
    }

    const drivers = await Driver.find({
      location: { $near: { $geometry: { type: "Point", coordinates: [userCoords.lng, userCoords.lat] }} },
      status: "online",
      "availability.isAvailable": true,
      services: serviceType,
       vehicleType: { $in: ["minitruck", "truck"] }, //for curior
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
            { lat: userCoords.lat, lng: userCoords.lng },
            "driving"
          );
        } catch (err) {
          console.warn("ETA calculation failed for driver:",driver._id,err.message);
        }

        let fareEstimate = null;
        try {
          const distData = await GoogleMapsService.calculateDistance(
            { lat: userCoords.lat, lng: userCoords.lng },
            {lat: destCoords.lat, lng: destCoords.lng },
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

// REQUEST FREIGHT RIDE

exports.createRideForFreight = async (req, res) => {
  try {
    const {
      pickup,
      destination,
      driverId,
      vehicleType,
      serviceType = "curior",
      offeredFare,
      paymentMethod = "cash",
      ItemName,
      description,
      weight,
      quintal,
      kilogram,
      gram,
      userId,
      rideNotes,
      Recipient,
      phone,
      email,
    } = req.body;
    if (
      !pickup ||
      !destination ||
      !driverId ||
      !vehicleType ||
      !userId ||
      !ItemName ||
      !description ||
      !Recipient ||
      !quintal ||
      !kilogram ||
      !gram
    )
      return res.status(400).json({
        success: false,
        message:
          "Pickup, destination, driver, vehicle type, ItemName, description, Recipient, quintal, kilogram, gram, and userId are required",
      });
    const quintalInKg = parseFloat(quintal || 0) * 100; // 1 quintal = 100 kg
    const kg = parseFloat(kilogram || 0);
    const gramInKg = parseFloat(gram || 0) / 1000; // 1000 grams = 1 kg

    const totalWeightKg = quintalInKg + kg + gramInKg;

    //  Range check (between 1 and 2 quintals)
    if (totalWeightKg < 100 || totalWeightKg > 200) {
      return res.status(400).json({
        success: false,
        message: "Weight should be between 1 and 2 quintals (100kg to 200kg)",
      });
    }
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
        minitruck: { base: 80, perKm: 20 },
        truck: { base: 120, perKm: 25}
      };
      const rate = fareRates[vehicleType] || fareRates.truck;
      estimatedFare = Math.round(rate.base + distance * rate.perKm);
    } catch (error) {
      distance = 5;
      duration = 15;
      estimatedFare =
        vehicleType === "minitruck" ? 1700 : vehicleType === "truck" ? 3125 : 3500;
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
      // requestedAt: new Date(),
      serviceDetails: {
        name: ItemName,
        description: description,
        weight: {
          quintal: quintalInKg,
          kilogram: kg,
          gram: gramInKg,
        },
        deliverTo: {
          name: Recipient,
          phone: phone,
          email: email,
        },
        preDeliveryOTP: 0,
        preDeliveryOTPVerified: false,
      },
    });
    const rideCreated = await Ride.create(ride);
    await rideCreated.populate("driver", "name phone vehicle rating");

    return res.status(201).json({
      success: true,
      message: "Ride for Freight requested successfully",
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
        ItemName: rideCreated.serviceDetails.name,
        Description: rideCreated.serviceDetails.description,
        weight: rideCreated.serviceDetails.weight,
        DeliverTo: rideCreated.serviceDetails.deliverTo.name,
      },
    });
  } catch (error) {
    console.error("Ride for Freight request error:", error.message);
    res
      .status(500)
      .json({ success: false, message: "Failed to request ride for Freight" });
  }
};

// Confirm Freight Ride by driver

exports.acceptedFreightRideByDriverr = async (req, res) => {
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

//Start Freight ride after getting confirmation with Driver using otp

exports.startFreight = async (req, res) => {
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

// CANCEL Freight

exports.cancelFreight = async (req, res) => {
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
        .json({ success: false, message: "You can't denie/cancel for Goods pick-up now!" });

 
    const canceledFreightRide = await Ride.findByIdAndUpdate(
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

    if (canceledFreightRide.driver)
      await Driver.findByIdAndUpdate(canceledFreightRide.driver, {
        "availability.isAvailable": true,
      });

    return res.status(200).json({
      success: true,
      message: "Goods(Freight) pick-up cancelled successfully",
      data: {
        rideId: canceledFreightRide._id,
        status: canceledFreightRide.status,
        cancellationFee: canceledFreightRide.cancellationFee
      },
    });
  } catch (error) {
    console.error("Cancel Freight ride error:", error);
    res.status(500).json({ success: false, message: "Failed to cancel Freight ride" });
  }
};

// COMPLETE RIDE FOR Freight

exports.freightRideCompleted = async (req, res) => {
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

    const completedCuriorRide = await Ride.findByIdAndUpdate(
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

    if (completedCuriorRide.driver)
      await Driver.findByIdAndUpdate(completedCuriorRide.driver, {
        "availability.isAvailable": true,
      });

    return res.status(200).json({
      success: true,
      message: "Freight delivery completed successfully",
      data: {
        rideId: completedCuriorRide._id,
        status: completedCuriorRide.status,
      },
    });
  } catch (error) {
    console.error("Completed Freight ride error:", error);
    res.status(500).json({ success: false, message: "Failed to complete the Freight ride" });
  }
};

// GIVE Rating for both user and driver

exports.ratingForFreight = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { userId, userRating, driverRating, userComment, driverComment } =
      req.body;

    if (!rideId || !userId)
      return res
        .status(400)
        .json({
          success: true,
          message: "Ride id and user id both are required",
        });

    const ride = await Ride.findOne({
      _id: rideId,
      status: "completed",
    });
    if (!ride)
      return res
        .status(404)
        .json({ success: false, message: "Ride not found or not completed" });

    if (ride.user.toString() !== userId)
      return res.status(403).json({ success: false, message: "Unauthorized" });

    const ratingForRide = await Ride.findByIdAndUpdate(
      rideId,
      {
        $set: {
          "rating.userRating": userRating ? Number(userRating) : 0,
          "rating.driverRating": driverRating ? Number(driverRating) : 0,
          "rating.userComment": userComment ? userComment : "",
          "rating.driverComment": driverComment ? driverComment : "",
        },
      },
      { upsert: true }
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
        driverComment: ratingForRide.rating.driverComment,
      },
    });
  } catch (error) {
    console.error("Rating Freight ride error:", error);
    res.status(500).json({ success: false, message: "Failed to rating Freight ride" });
  }
};
