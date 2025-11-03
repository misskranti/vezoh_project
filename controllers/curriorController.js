const { validationResult } = require("express-validator");
const Driver = require("../models/driver");
const Vehicle = require("../models/vehicle.js");
const Ride = require("../models/ride.js");
const GoogleMapsService = require("../utils/googleMapsService");
const { generateOTP } = require("../utils/helpers.js");
// const rideService = require("../utils/services.js");
const { sendMessageToSocketId } = require("../socket.js");
const { sendEmailVerificationOTP } = require("../utils/emailService");
const driver = require("../models/driver");

// FIND NEARBY DRIVERS for curior  (["car", "auto","minitruck", "truck"])
exports.findDriverNearByForCurior = async (req, res) => {
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
            // coordinates: [parseFloat(longitude), parseFloat(latitude)],
          },
        },
      },
      status: "online",
      "availability.isAvailable": true,
      services: serviceType,
       vehicleType: { $in: ["car", "auto","minitruck", "truck"] }, //for curior
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
      minitruck: { base: 80, perKm: 20, perMin: 2.5, surge: 1.0 },
      truck: { base: 120, perKm: 25, perMin: 3, surge: 1.0 },
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


// REQUEST RIDE FOR CURIOR

exports.createRideForCurior = async (req, res) => {
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
      !Recipient
    )
      return res.status(400).json({
        success: false,
        message:
          "Pickup, destination, driver, vehicle type, ItemName, description, Recipient and userId are required",
      });

        const kg = parseFloat(kilogram || 0);
    const gramInKg = parseFloat(gram || 0) / 1000; // 1000 grams = 1 kg

    const totalWeightKg = kg + gramInKg;

    //  Range check (between 1 and 100 KG)
    if (totalWeightKg < 1 || totalWeightKg > 100) {
      return res.status(400).json({
        success: false,
        message: "Weight should be between 1 and 100 kilograms",
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
        auto: { base: 30, perKm: 12 },
        car: { base: 50, perKm: 15 },
        minitruck: { base: 80, perKm: 20 },
        truck: { base: 120, perKm: 25}
      };
      const rate = fareRates[vehicleType] || fareRates.auto;
      estimatedFare = Math.round(rate.base + distance * rate.perKm);
    } catch (error) {
      distance = 5;
      duration = 15;
      estimatedFare =
        vehicleType === "auto" ? 420 : vehicleType === "car" ? 825 : 1700;
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
    //   requestedAt: new Date(),
      serviceDetails: {
        name: ItemName,
        description: description,
         weight: {
          quintal: quintalInKg ? parseFloat(quintalInKg) : 0,
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
          rating: {
      userRating: 0,
      driverRating: 0,
      userComment: "",
      driverComment: "",
    }
    });
    const rideCreated = await Ride.create(ride);
    await rideCreated.populate("driver", "name phone vehicle rating");

    return res.status(201).json({
      success: true,
      message: "Ride for Curior requested successfully",
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
    console.error("Ride for curior request error:", error.message);
    res
      .status(500)
      .json({ success: false, message: "Failed to request ride for curior" });
  }
};

// Confirm Ride by driver

exports.acceptedCuriorRideByDriverr = async (req, res) => {
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

//Start Curior ride after getting confirmation with Driver using otp

exports.startCurior = async (req, res) => {
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

// CANCEL Curior

exports.cancelCurior = async (req, res) => {
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
        .json({ success: false, message: "You can't denie/cancel for curior pick-up now!" });

 
    const canceledCuriorRide = await Ride.findByIdAndUpdate(
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

    if (canceledCuriorRide.driver)
      await Driver.findByIdAndUpdate(canceledCuriorRide.driver, {
        "availability.isAvailable": true,
      });

    return res.status(200).json({
      success: true,
      message: "Curior pick-up cancelled successfully",
      data: {
        rideId: canceledCuriorRide._id,
        status: canceledCuriorRide.status,
        cancellationFee: canceledCuriorRide.cancellationFee
      },
    });
  } catch (error) {
    console.error("Cancel Curior ride error:", error);
    res.status(500).json({ success: false, message: "Failed to cancel curior ride" });
  }
};

// COMPLETE RIDE FOR CURIOR

exports.curiorRideCompleted = async (req, res) => {
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
      message: "Curior delivered successfully",
      data: {
        rideId: completedCuriorRide._id,
        status: completedCuriorRide.status,
      },
    });
  } catch (error) {
    console.error("Complete Curiore error:", error);
    res.status(500).json({ success: false, message: "Failed to Complete Curior" });
  }
};

// GIVE Rating for both user and driver

exports.ratingForCurior = async (req, res) => {
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
        .json({ success: false, message: "Curior Ride not found or not completed" });
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

//---------------ONLY FOR DRIVER BEFORE DELIVERY  -----------------
// send OTP before delivery

exports.sendOTPBeforeDelivery = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { driverId } = req.body;

    if (!rideId || !driverId) {
      return res.status(400).json({
        status: false,
        message: "Ride ID and Driver ID are both required.",
      });
    }

    const ride = await Ride.findOne({
      _id: rideId,
      driver: driverId,
      status: "started",
    }).populate("user", "_id name email phone");

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: "Ride not found or not started.",
      });
    }
   if(ride.serviceDetails.preDeliveryOTPVerified){     
  return res.status(400).json({
        success: false,
        message: "OTP already sent and verified.",
      });       
   }
    const otp = Math.floor(1000 + Math.random() * 9000);

      let targetName = ride.user.name;
      await sendEmailVerificationOTP(ride.user.email, otp, targetName);
    

    ride.serviceDetails.preDeliveryOTP = otp;
    await ride.save();

    console.log(`[DEBUG] OTP ${otp} sent successfully to ${targetName}`);

    return res.status(200).json({
      success: true,
      message: `OTP sent to ${targetName} successfully!`,
    });
  } catch (err) {
    console.error(`[ERROR] sendOTPBeforeDelivery:`, err);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error: " + err.message,
    });
  }
};

//verify OTP before delivery

exports.verifyOTPBeforeDelivery = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { otp, driverId } = req.body;
    if (!rideId || !driverId || !otp)
      return res
        .status(400)
        .json({
          success: false,
          message: "Ride ID, DriverId and OTP all are required",
        });

    const getRide = await Ride.findOne({
      rideId,
      driver: driverId,
      status: "started",
    });
    if (!getRide)
      return res
        .status(404)
        .json({ success: false, message: "Ride not found or not started." });
 if(getRide.serviceDetails.preDeliveryOTPVerified){     
  return res.status(400).json({
        success: false,
        message: "OTP already verified .",
      });       
   }
    if (getRide.serviceDetails.preDeliveryOTP !== parseInt(otp)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid OTP provided." });
    }
    getRide.serviceDetails.preDeliveryOTPVerified = true;
    await getRide.save();   

    return res
      .status(200)
      .json({
        success: true,
        message:
          "OTP verified successfully. You can proceed with the delivery.",
      });
  } catch (err) {
    console.error(`[ERROR] verifyOTPBeforeDelivery:`, err);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error: " + err.message,
    });
  }
};