const GoogleMapsService = require("../utils/googleMapsService")
const { auth } = require("../middleware/auth.js");

// LOCATION AUTOCOMPLETE API(Auto suggetion for location)

exports.suggetionOnLocation = async (req, res) => {
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
};

// GEOCODE API(Call this api when user can select a particular location)

exports.geoDecode = async (req, res) => {
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
};

// ESTIMATE FARE

exports.estimateFare = async (req, res) => {
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
};