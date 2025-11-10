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
      vehicleType: { $in: ["auto","minitruck", "truck"] },  //for freight
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
      auto: { base: 30, perKm: 14, perMin: 1.5, surge: 1.0 },
      car: { base: 50, perKm: 20, perMin: 2, surge: 1.0 },
      minitruck: { base: 80, perKm: 30, perMin: 2.5, surge: 1.0 },
      truck: { base: 120, perKm: 35, perMin: 3, surge: 1.0 },
    };

    const driverResults = await Promise.all(drivers.map(async (driver) => {

        if (!driver.location?.coordinates || 
            driver.location.coordinates[0] === 0 && driver.location.coordinates[1] === 0) {
          console.warn("Skipping driver with invalid location:", driver._id);
          return null;
        }

        const vehicle = vehicles.find((v) => v.driver.toString() === driver._id.toString());
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
        let distanceInfo = null;
        let durationInfo = null;
        
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
          fareEstimate = Math.round((rate.base + distanceKm * rate.perKm + durationMin * rate.perMin) * rate.surge);
          
          distanceInfo = {
            text: distData.distance.text,
            value: distData.distance.value,
            km: Math.round(distanceKm * 100) / 100
          };
          
          durationInfo = {
            text: distData.duration.text,
            value: distData.duration.value,
            minutes: Math.ceil(durationMin)
          };
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
          distance: distanceInfo,
          duration: durationInfo,
          eta: etaData ? { text: etaData.duration.text, value: etaData.duration.value, minutes: Math.ceil(etaData.duration.value / 60) } : null,
        };
      })
    );

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
      serviceType = "freight",
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

    //  Range check (between 1 and 4 quintals)
    if (totalWeightKg < 100 || totalWeightKg > 400) {
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
        auto: { base: 30, perKm: 14 },
        minitruck: { base: 80, perKm: 30 },
        truck: { base: 120, perKm: 35}
      };

      const rate = fareRates[vehicleType] || fareRates.truck;
      estimatedFare = Math.round(rate.base + distance * rate.perKm);
    } catch (error) {
      distance = 5;
      duration = 15;
      estimatedFare =
        vehicleType === "auto" ? 490 : vehicleType === "minitruck" ? 2550 : 4375;
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
      message: "Goods(Freight) delivery completed successfully",
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
        .json({ success: false, message: "Freight Ride not found or not completed" });
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