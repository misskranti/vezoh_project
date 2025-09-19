const express = require("express")
const router = express.Router()
const User = require("../models/user")
const Driver = require("../models/driver")
const Vehicle = require("../models/vehicle.js")
const Ride = require("../models/ride")
const GoogleMapsService = require("../utils/googleMapsService")
const { auth } = require("../middleware/auth.js");

// ===========================================
// 1. LOCATION AUTOCOMPLETE API
// ===========================================

router.get("/locations/autocomplete", auth, async (req, res) => {
  try {
    const { input, sessionToken, lat, lng } = req.query;
    if (!input || input.length < 3) return res.json({ success: true, data: [] });

    const userLocation = lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null;
    const suggestions = await GoogleMapsService.getAutocomplete(input, sessionToken, userLocation);

    res.json({ success: true, data: suggestions });
  } catch (error) {
    console.error("Autocomplete error:", error);
    res.status(500).json({ success: false, message: "Failed to get location suggestions" });
  }
});

// ===========================================
// 2. GEOCODE API
// ===========================================

router.get("/locations/geocode", auth, async (req, res) => {
  try {
    const { address, latitude, longitude } = req.query;

    if (address) {
      const geocodeResult = await GoogleMapsService.geocodeAddress(address);
      return res.json({ success: true, data: geocodeResult, type: "forward_geocoding" });
    }

    if (latitude && longitude) {
      const reverseGeocodeResult = await GoogleMapsService.reverseGeocode(latitude, longitude);
      return res.json({ success: true, data: reverseGeocodeResult, type: "reverse_geocoding" });
    }

    return res.status(400).json({ success: false, message: "Either address or coordinates are required" });
  } catch (error) {
    console.error("Geocoding error:", error);
    res.status(500).json({ success: false, message: "Failed to process geocoding request" });
  }
});

// ===========================================
// 3. ESTIMATE FARE
// ===========================================

router.post("/ride/estimate-fare", async (req, res) => {
  try {
    const { pickup, destination, vehicleType = "auto" } = req.body;

    if (!pickup?.latitude || !pickup?.longitude || !destination?.latitude || !destination?.longitude) {
      return res.status(400).json({ success: false, message: "Pickup and destination coordinates are required" });
    }

    const distanceData = await GoogleMapsService.calculateDistance(
      { lat: pickup.latitude, lng: pickup.longitude },
      { lat: destination.latitude, lng: destination.longitude },
      "driving"
    );

    const distanceKm = distanceData.distance.value / 1000;
    const durationMin = distanceData.duration.value / 60;

    const fareRates = {
      bike: { base: 20, perKm: 8, perMin: 1, surge: 1.0 },
      auto: { base: 30, perKm: 12, perMin: 1.5, surge: 1.0 },
      car: { base: 50, perKm: 15, perMin: 2, surge: 1.0 },
    };

    const rate = fareRates[vehicleType] || fareRates.auto;
    const baseFare = rate.base + distanceKm * rate.perKm + durationMin * rate.perMin;
    const estimatedFare = Math.round(baseFare * rate.surge);

    res.json({
      success: true,
      data: {
        estimatedFare,
        fareRange: { min: Math.round(estimatedFare * 0.9), max: Math.round(estimatedFare * 1.1) },
        distance: { text: distanceData.distance.text, value: distanceData.distance.value, km: Math.round(distanceKm * 100) / 100 },
        duration: { text: distanceData.duration.text, value: distanceData.duration.value, minutes: Math.ceil(durationMin) },
        vehicleType,
        surgeMultiplier: rate.surge,
      },
    });
  } catch (error) {
    console.error("Fare estimation error:", error);
    res.status(500).json({ success: false, message: "Failed to estimate fare" });
  }
});

// ===========================================
// 4. FIND NEARBY DRIVERS
// ===========================================

router.get("/ride/nearby-drivers", auth, async (req, res) => {
  try {
    const { latitude, longitude, radius = 5000, serviceType, vehicleType, destinationLat, destinationLng } = req.query;

    if (!latitude || !longitude || !serviceType || !destinationLat || !destinationLng) {
      return res.status(400).json({ message: "latitude, longitude, serviceType, destinationLat, and destinationLng are required" });
    }

    const drivers = await Driver.find({
      location: { $near: { $geometry: { type: "Point", coordinates: [parseFloat(longitude), parseFloat(latitude)] }, $maxDistance: parseInt(radius) } },
      status: "online",
      "availability.isAvailable": true,
      services: serviceType,
    })
      .limit(20)
      .lean();

    if (!drivers.length) return res.json([]);

    const driverIds = drivers.map(d => d._id);
    const vehicles = await Vehicle.find({ driver: { $in: driverIds } }).lean();

    const fareRates = {
      bike: { base: 20, perKm: 8, perMin: 1, surge: 1.0 },
      auto: { base: 30, perKm: 12, perMin: 1.5, surge: 1.0 },
      car: { base: 50, perKm: 15, perMin: 2, surge: 1.0 },
    };

    const driverResults = await Promise.all(drivers.map(async driver => {
      const vehicle = vehicles.find(v => v.driver.toString() === driver._id.toString());
      if (vehicleType && vehicle?.vehicle?.type !== vehicleType) return null;

      let etaData = null;
      try {
        etaData = await GoogleMapsService.calculateDistance(
          { lat: driver.location.coordinates[1], lng: driver.location.coordinates[0] },
          { lat: parseFloat(latitude), lng: parseFloat(longitude) },
          "driving"
        );
      } catch (err) { console.warn("ETA calculation failed for driver:", driver._id, err.message); }

      let fareEstimate = null;
      try {
        const distData = await GoogleMapsService.calculateDistance(
          { lat: parseFloat(latitude), lng: parseFloat(longitude) },
          { lat: parseFloat(destinationLat), lng: parseFloat(destinationLng) },
          "driving"
        );

        const distanceKm = distData.distance.value / 1000;
        const durationMin = distData.duration.value / 60;
        const rate = fareRates[vehicleType || "auto"];
        fareEstimate = Math.round((rate.base + distanceKm * rate.perKm + durationMin * rate.perMin) * rate.surge);
      } catch (err) { console.warn("Fare calculation failed for driver:", driver._id, err.message); }

      return {
        _id: driver._id,
        name: driver.name,
        phone: driver.phone,
        profileImage: driver.profileImage,
        rating: driver.rating,
        location: { lat: driver.location.coordinates[1], lng: driver.location.coordinates[0], address: driver.location.address },
        vehicle: vehicle?.vehicle || null,
        vehicleVerification: vehicle?.verificationStatus, //|| "pending",
        estimatedFare: fareEstimate,
        eta: etaData ? { text: etaData.duration.text, value: etaData.duration.value, minutes: Math.ceil(etaData.duration.value / 60) } : null,
      };
    }));

    res.json(driverResults.filter(Boolean));
  } catch (error) {
    console.error("Error fetching nearby drivers:", error);
    res.status(500).json({ message: "Failed to fetch nearby drivers" });
  }
});

// ===========================================
// 5. REQUEST RIDE
// ===========================================

router.post("/ride/request", async (req, res) => {
  try {
    const { pickup, destination, driverId, vehicleType, serviceType = "ride", offeredFare, paymentMethod = "cash", userId, rideNotes } = req.body;
    if (!pickup || !destination || !driverId || !vehicleType || !userId) return res.status(400).json({ success: false, message: "Pickup, destination, driver, vehicle type, and userId are required" });

    const driver = await Driver.findById(driverId);
    if (!driver || !driver.availability.isAvailable || driver.status !== "online") return res.status(400).json({ success: false, message: "Driver is no longer available" });

    let distanceData, estimatedFare, distance, duration;
    try {
      distanceData = await GoogleMapsService.calculateDistance({ lat: pickup.latitude, lng: pickup.longitude }, { lat: destination.latitude, lng: destination.longitude }, "driving");
      distance = distanceData.distance.value / 1000;
      duration = distanceData.duration.value / 60;

      const fareRates = { bike: { base: 20, perKm: 8 }, auto: { base: 30, perKm: 12 }, car: { base: 50, perKm: 15 } };
      const rate = fareRates[vehicleType] || fareRates.auto;
      estimatedFare = Math.round(rate.base + distance * rate.perKm);
    } catch (error) {
      distance = 5; duration = 15;
      estimatedFare = vehicleType === "bike" ? 60 : vehicleType === "auto" ? 80 : 120;
    }

    const ride = new Ride({
      user: userId,
      driver: driverId,
      pickup,
      destination,
      serviceType,
      vehicleType,
      fare: { estimated: estimatedFare, offered: offeredFare || estimatedFare, final: null },
      distance: { estimated: Math.round(distance * 100) / 100, text: distanceData?.distance.text || `${Math.round(distance)} km`, value: distanceData?.distance.value || Math.round(distance * 1000) },
      duration: { estimated: Math.ceil(duration), text: distanceData?.duration.text || `${Math.ceil(duration)} min`, value: distanceData?.duration.value || Math.ceil(duration * 60) },
      paymentMethod,
      rideNotes: rideNotes || "",
      status: "requested",
      requestedAt: new Date(),
    });

    await ride.save();
    await ride.populate("driver", "name phone vehicle rating");

    res.status(201).json({ success: true, message: "Ride requested successfully", data: { rideId: ride._id, status: ride.status, driver: ride.driver, pickup: ride.pickup, destination: ride.destination, fare: ride.fare, distance: ride.distance, duration: ride.duration, estimatedArrival: null } });
  } catch (error) {
    console.error("Ride request error:", error);
    res.status(500).json({ success: false, message: "Failed to request ride" });
  }
});

// ===========================================
// 6. GET ACTIVE RIDE
// ===========================================

router.get("/ride/active", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, message: "UserId is required" });

    const activeRide = await Ride.findOne({ user: userId, status: { $in: ["requested", "accepted", "arriving", "arrived", "pickup", "in_progress"] } })
      .populate("driver", "name phone vehicle location rating profileImage")
      .sort({ createdAt: -1 });

    if (!activeRide) return res.json({ success: true, data: null, message: "No active ride found" });

    let driverETA = null;
    if (["accepted", "arriving"].includes(activeRide.status) && activeRide.driver?.location?.coordinates) {
      try {
        const [lng, lat] = activeRide.driver.location.coordinates;
        const etaData = await GoogleMapsService.calculateDistance({ lat, lng }, { lat: activeRide.pickup.latitude, lng: activeRide.pickup.longitude }, "driving");
        driverETA = { text: etaData.duration.text, value: etaData.duration.value, minutes: Math.ceil(etaData.duration.value / 60) };
      } catch (error) { console.warn("Failed to calculate driver ETA:", error.message); }
    }

    res.json({ success: true, data: { rideId: activeRide._id, status: activeRide.status, driver: activeRide.driver, pickup: activeRide.pickup, destination: activeRide.destination, fare: activeRide.fare, distance: activeRide.distance, duration: activeRide.duration, paymentMethod: activeRide.paymentMethod, driverETA } });
  } catch (error) {
    console.error("Get active ride error:", error);
    res.status(500).json({ success: false, message: "Failed to get active ride" });
  }
});

// ===========================================
// 7. CANCEL RIDE
// ===========================================

router.patch("/ride/:rideId/cancel", async (req, res) => {
  try {
    const { rideId } = req.params;
    const { reason, userId } = req.body;

    const ride = await Ride.findById(rideId);
    if (!ride) return res.status(404).json({ success: false, message: "Ride not found" });
    if (ride.user.toString() !== userId) return res.status(403).json({ success: false, message: "Unauthorized" });

    const cancellableStatuses = ["requested", "accepted", "arriving"];
    if (!cancellableStatuses.includes(ride.status)) return res.status(400).json({ success: false, message: "Ride cannot be cancelled now" });

    const CANCELLATION_FEE = 25;
    ride.status = "cancelled";
    ride.cancellationReason = reason;
    ride.cancellationFee = CANCELLATION_FEE;
    ride.cancelledAt = new Date();
    await ride.save();

    if (ride.driver) await Driver.findByIdAndUpdate(ride.driver, { "availability.isAvailable": true });

    res.json({ success: true, message: "Ride cancelled", data: { rideId: ride._id, status: ride.status, cancellationFee: CANCELLATION_FEE, refundAmount: Math.max(0, ride.fare.offered - CANCELLATION_FEE) } });
  } catch (error) {
    console.error("Cancel ride error:", error);
    res.status(500).json({ success: false, message: "Failed to cancel ride" });
  }
});

// ===========================================
// 8. GET RIDE HISTORY
// ===========================================

router.get("/ride/history", async (req, res) => {
  try {
    const { userId, page = 1, limit = 10, status } = req.query;
    if (!userId) return res.status(400).json({ success: false, message: "UserId is required" });

    const query = { user: userId };
    if (status) query.status = status; else query.status = { $in: ["completed", "cancelled"] };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const rides = await Ride.find(query).populate("driver", "name phone vehicle rating").sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));
    const totalRides = await Ride.countDocuments(query);

    const ridesWithDetails = rides.map(ride => ({
      rideId: ride._id,
      status: ride.status,
      driver: ride.driver,
      pickup: ride.pickup,
      destination: ride.destination,
      fare: { final: ride.fare.final || ride.fare.offered, paymentMethod: ride.paymentMethod },
      distance: ride.distance,
      duration: ride.duration,
      date: ride.createdAt,
      completedAt: ride.completedAt,
      cancelledAt: ride.cancelledAt,
      cancellationReason: ride.cancellationReason,
    }));

    res.json({ success: true, data: { rides: ridesWithDetails, pagination: { currentPage: parseInt(page), totalPages: Math.ceil(totalRides / parseInt(limit)), totalRides } } });
  } catch (error) {
    console.error("Get ride history error:", error);
    res.status(500).json({ success: false, message: "Failed to get ride history" });
  }
});

module.exports = router;
