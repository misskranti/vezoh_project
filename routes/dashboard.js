const express = require("express")
const router = express.Router()
const User = require("../models/user")
const Driver = require("../models/driver")
const Ride = require("../models/ride")
const GoogleMapsService = require("../utils/googleMapsService")
const { auth } = require("../middleware/auth.js");

// Places API

router.get("/locations/autocomplete", auth, async (req, res) => {
  try {
    const { input, sessionToken, lat, lng } = req.query

    if (!input) {
      return res.status(400).json({
        success: false,
        message: "Input is required",
      })
    }

    const userLocation = lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null
    const suggestions = await GoogleMapsService.getAutocomplete(input, sessionToken, userLocation)

    res.json({
      success: true,
      data: suggestions,
    })
  } catch (error) {
    console.error("Autocomplete error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to get autocomplete suggestions",
    })
  }
})

// Geocoding API 

router.get("/locations/geocode",auth, async (req, res) => {
  try {
    const { address, latitude, longitude } = req.query;

    if (address) {
      const geocodeResult = await GoogleMapsService.geocodeAddress(address)
      return res.json({
        success: true,
        data: geocodeResult,
        type: "forward_geocoding"
      })
    }

    if (latitude && longitude) {
      const reverseGeocodeResult = await GoogleMapsService.reverseGeocode(latitude, longitude)
      return res.json({
        success: true,
        data: reverseGeocodeResult,
        type: "reverse_geocoding"
      })
    }

    return res.status(400).json({
      success: false,
      message: "Either address or coordinates (latitude & longitude) are required",
    })
  } catch (error) {
    console.error("Geocoding error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to process geocoding request",
    })
  }
})

// Distance Matrix API

router.post("/locations/distance", async (req, res) => {
  try {
    const { origin, destination, mode = "driving" } = req.body

    if (!origin || !destination || !origin.lat || !origin.lng || !destination.lat || !destination.lng) {
      return res.status(400).json({
        success: false,
        message: "Origin and destination coordinates are required",
      })
    }

    const distanceResult = await GoogleMapsService.calculateDistance(origin, destination, mode)

    res.json({
      success: true,
      data: distanceResult,
    })
  } catch (error) {
    console.error("Distance calculation error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to calculate distance",
    })
  }
})

// Find nearby available drivers with accurate Google Maps distance/ETA

router.post("/drivers/nearby", async (req, res) => {
  try {
    const { latitude, longitude, vehicleType, serviceType = "ride", radius = 5000 } = req.body

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      })
    }

    // Find nearby drivers using MongoDB geospatial query
    const nearbyDrivers = await Driver.find({
      "location.coordinates.latitude": { $exists: true },
      "location.coordinates.longitude": { $exists: true },
      status: "online",
      "availability.isAvailable": true,
      services: serviceType,
      ...(vehicleType && { "vehicle.type": vehicleType }),
      $expr: {
        $lte: [
          {
            $multiply: [
              6371000, // Earth's radius in meters
              {
                $acos: {
                  $add: [
                    {
                      $multiply: [
                        { $sin: { $degreesToRadians: "$location.coordinates.latitude" } },
                        { $sin: { $degreesToRadians: latitude } },
                      ],
                    },
                    {
                      $multiply: [
                        { $cos: { $degreesToRadians: "$location.coordinates.latitude" } },
                        { $cos: { $degreesToRadians: latitude } },
                        { $cos: { $degreesToRadians: { $subtract: ["$location.coordinates.longitude", longitude] } } },
                      ],
                    },
                  ],
                },
              },
            ],
          },
          radius,
        ],
      },
    })
      .select("name phone vehicle location rating stats")
      .limit(10)

    // Calculate REAL distance for each driver using Google Distance Matrix API
    const driversWithDistance = await Promise.all(
      nearbyDrivers.map(async (driver) => {
        const driverLat = driver.location.coordinates.latitude
        const driverLng = driver.location.coordinates.longitude

        try {
          // Use Google Distance Matrix API for accurate distance and time
          const distanceData = await GoogleMapsService.calculateDistance(
            { lat: driverLat, lng: driverLng },
            { lat: latitude, lng: longitude },
            "driving"
          )

          return {
            ...driver.toObject(),
            distance: {
              text: distanceData.distance.text, // "3.2 km"
              value: distanceData.distance.value, // 3200 meters
              km: Math.round(distanceData.distance.value / 10) / 100, // 3.2
            },
            estimatedArrival: {
              text: distanceData.duration.text, // "12 mins" 
              value: distanceData.duration.value, // 720 seconds
              minutes: Math.ceil(distanceData.duration.value / 60), // 12
            },
          }
        } catch (error) {
          console.warn(`Failed to get accurate distance for driver ${driver._id}, using fallback:`, error.message)
          
          // Fallback to Haversine calculation if Google API fails
          const R = 6371 // Earth's radius in km
          const dLat = ((driverLat - latitude) * Math.PI) / 180
          const dLng = ((driverLng - longitude) * Math.PI) / 180
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((latitude * Math.PI) / 180) *
              Math.cos((driverLat * Math.PI) / 180) *
              Math.sin(dLng / 2) *
              Math.sin(dLng / 2)
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
          const distance = R * c

          return {
            ...driver.toObject(),
            distance: {
              text: `${Math.round(distance * 100) / 100} km`,
              value: distance * 1000, // meters
              km: Math.round(distance * 100) / 100,
            },
            estimatedArrival: {
              text: `${Math.ceil(distance * 2)} min`,
              value: Math.ceil(distance * 2) * 60, // seconds
              minutes: Math.ceil(distance * 2),
            },
          }
        }
      })
    )

    // Sort by distance (closest drivers first)
    driversWithDistance.sort((a, b) => a.distance.value - b.distance.value)

    res.json({
      success: true,
      data: {
        drivers: driversWithDistance,
        count: driversWithDistance.length,
      },
    })
  } catch (error) {
    console.error("Find nearby drivers error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to find nearby drivers",
    })
  }
})


//Request a ride with REAL Google Maps distance and fare calculation

router.post("/rides/request", async (req, res) => {
  try {
    const { pickup, destination, vehicleType, serviceType = "ride", offeredFare, paymentMethod = "cash", userId } = req.body

    if (!pickup || !destination || !vehicleType || !userId) {
      return res.status(400).json({
        success: false,
        message: "Pickup, destination, vehicle type, and userId are required",
      })
    }

    let distanceData, estimatedFare, distance, duration

    try {
      // Calculate REAL distance and duration using Google Distance Matrix API
      distanceData = await GoogleMapsService.calculateDistance(
        { lat: pickup.latitude, lng: pickup.longitude },
        { lat: destination.latitude, lng: destination.longitude },
        "driving"
      )

      distance = distanceData.distance.value / 1000 // Convert meters to km
      duration = distanceData.duration.value / 60 // Convert seconds to minutes

      // Calculate accurate fare based on vehicle type and REAL distance
      const baseFare = vehicleType === "bike" ? 20 : vehicleType === "auto" ? 30 : 50
      const perKmRate = vehicleType === "bike" ? 8 : vehicleType === "auto" ? 12 : 15
      estimatedFare = Math.round(baseFare + distance * perKmRate)
    } catch (error) {
      console.warn("Failed to get accurate distance from Google, using fallback calculation:", error.message)
      
      // Fallback calculation if Google API fails
      const R = 6371 // Earth's radius in km
      const dLat = ((pickup.latitude - destination.latitude) * Math.PI) / 180
      const dLng = ((pickup.longitude - destination.longitude) * Math.PI) / 180
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((pickup.latitude * Math.PI) / 180) *
          Math.cos((destination.latitude * Math.PI) / 180) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      distance = R * c
      duration = distance * 3 // 3 minutes per km estimate
      
      const baseFare = vehicleType === "bike" ? 20 : vehicleType === "auto" ? 30 : 50
      estimatedFare = Math.round(baseFare + distance * 8)
    }

    // Create ride request with accurate data
    const ride = new Ride({
      user: userId,
      pickup,
      destination,
      serviceType,
      vehicleType,
      fare: {
        estimated: estimatedFare,
        offered: offeredFare || estimatedFare,
      },
      distance: {
        estimated: Math.round(distance * 100) / 100, // km
        text: distanceData?.distance.text || `${Math.round(distance * 100) / 100} km`,
        value: distanceData?.distance.value || Math.round(distance * 1000), // meters
      },
      duration: {
        estimated: Math.ceil(duration), // minutes
        text: distanceData?.duration.text || `${Math.ceil(duration)} min`,
        value: distanceData?.duration.value || Math.ceil(duration * 60), // seconds
      },
      paymentMethod,
    })

    await ride.save()

    res.status(201).json({
      success: true,
      message: "Ride requested successfully",
      data: ride,
    })
  } catch (error) {
    console.error("Ride request error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to request ride",
    })
  }
})

// Get user's active rides

router.get("/rides/active", async (req, res) => {
  try {
    const { userId } = req.query

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "UserId is required",
      })
    }

    const activeRides = await Ride.find({
      user: userId,
      status: { $in: ["requested", "accepted", "driver_assigned", "pickup", "in_progress"] },
    })
      .populate("driver", "name phone vehicle location rating")
      .sort({ createdAt: -1 })

    res.json({
      success: true,
      data: activeRides,
    })
  } catch (error) {
    console.error("Get active rides error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to get active rides",
    })
  }
})

module.exports = router