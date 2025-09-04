const axios = require("axios")

class GoogleMapsService {
  // 1. PLACES API (New) - Autocomplete suggestions
  static async getAutocomplete(input, sessionToken = null, userLocation = null) {
    try {
      const requestBody = {
        input,
        includedRegionCodes: ["IN"],
        sessionToken: sessionToken || `sess-${Date.now().toString().slice(-10)}-${Math.random().toString(36).substring(2, 12)}`

      }

      if (userLocation && userLocation.lat && userLocation.lng) {
        requestBody.locationBias = {
          circle: {
            center: {
              latitude: userLocation.lat,
              longitude: userLocation.lng,
            },
            radius: 50000.0,
          },
        }
      }

      console.log('Making request to Places API (New) with:', JSON.stringify(requestBody, null, 2))

      const response = await axios.post(
        "https://places.googleapis.com/v1/places:autocomplete",
        requestBody,
        {
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY,
          },
        }
      )

      console.log('Places API Response:', JSON.stringify(response.data, null, 2))

      return response.data.suggestions?.map((suggestion) => ({
        placeId: suggestion.placePrediction?.placeId,
        text: suggestion.placePrediction?.text?.text,
        mainText: suggestion.placePrediction?.structuredFormat?.mainText?.text,
        secondaryText: suggestion.placePrediction?.structuredFormat?.secondaryText?.text || "",
        types: suggestion.placePrediction?.types || [],
      })) || []
    } catch (error) {
      console.error("Google Places Autocomplete API Error:", error.response?.data || error.message)
      console.log("Falling back to legacy Places API...")
      return await GoogleMapsService.getAutocompleteLegacy(input, sessionToken, userLocation)
    }
  }

  static async getAutocompleteLegacy(input, sessionToken = null, userLocation = null) {
    try {
      const generateLegacyToken = () => {
        return `session-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
      }

      const params = {
        input,
        key: process.env.GOOGLE_MAPS_API_KEY,
        components: 'country:in',
        sessiontoken: sessionToken || generateLegacyToken(),
      }

      if (userLocation && userLocation.lat && userLocation.lng) {
        params.location = `${userLocation.lat},${userLocation.lng}`
        params.radius = 50000
      }

      const response = await axios.get(
        "https://maps.googleapis.com/maps/api/place/autocomplete/json",
        { params }
      )

      if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
        throw new Error(`Places API Error: ${response.data.status} - ${response.data.error_message || 'Unknown error'}`)
      }

      return response.data.predictions?.map((prediction) => ({
        placeId: prediction.place_id,
        text: prediction.description,
        mainText: prediction.structured_formatting?.main_text || prediction.description,
        secondaryText: prediction.structured_formatting?.secondary_text || "",
        types: prediction.types,
      })) || []
    } catch (error) {
      console.error("Legacy Places API Error:", error.response?.data || error.message)
      throw new Error("Failed to get autocomplete suggestions")
    }
  }

  // 1. PLACES API - Text search for places
  static async searchPlaces(query, location = null) {
    try {
      const params = {
        query: query,
        key: process.env.GOOGLE_MAPS_API_KEY,
      }

      if (location) {
        params.location = `${location.lat},${location.lng}`
        params.radius = 50000
      }

      const response = await axios.get(
        "https://maps.googleapis.com/maps/api/place/textsearch/json",
        { params }
      )

      return response.data.results.map((place) => ({
        name: place.name,
        address: place.formatted_address,
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
        placeId: place.place_id,
        rating: place.rating || 0,
        types: place.types,
      }))
    } catch (error) {
      console.error("Google Places API Error:", error.response?.data || error.message)
      throw new Error("Failed to search places")
    }
  }

  // 2. GEOCODING API - Convert address to coordinates
  static async geocodeAddress(address) {
    try {
      const response = await axios.get(
        "https://maps.googleapis.com/maps/api/geocode/json",
        {
          params: {
            address: address,
            key: process.env.GOOGLE_MAPS_API_KEY,
            region: "in",
          },
        }
      )

      if (response.data.results.length === 0) {
        throw new Error("Address not found")
      }

      const result = response.data.results[0]
      return {
        address: result.formatted_address,
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        placeId: result.place_id,
        addressComponents: result.address_components,
        locationType: result.geometry.location_type,
      }
    } catch (error) {
      console.error("Geocoding API Error:", error.response?.data || error.message)
      throw new Error("Failed to geocode address")
    }
  }

  // 2. GEOCODING API - Convert coordinates to address
  static async reverseGeocode(lat, lng) {
    try {
      const response = await axios.get(
        "https://maps.googleapis.com/maps/api/geocode/json",
        {
          params: {
            latlng: `${lat},${lng}`,
            key: process.env.GOOGLE_MAPS_API_KEY,
          },
        }
      )

      if (response.data.results.length === 0) {
        throw new Error("No address found for coordinates")
      }

      const result = response.data.results[0]
      return {
        address: result.formatted_address,
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        placeId: result.place_id,
        addressComponents: result.address_components,
      }
    } catch (error) {
      console.error("Reverse Geocoding API Error:", error.response?.data || error.message)
      throw new Error("Failed to reverse geocode coordinates")
    }
  }

  // 3. DISTANCE MATRIX API - Calculate distance and ETA
  static async calculateDistance(origin, destination, mode = "driving") {
    try {
      const response = await axios.get(
        "https://maps.googleapis.com/maps/api/distancematrix/json",
        {
          params: {
            origins: `${origin.lat},${origin.lng}`,
            destinations: `${destination.lat},${destination.lng}`,
            key: process.env.GOOGLE_MAPS_API_KEY,
            units: "metric",
            mode: mode,
            avoid: "tolls",
          },
        }
      )

      const element = response.data.rows[0].elements[0]

      if (element.status !== "OK") {
        throw new Error(`Unable to calculate distance: ${element.status}`)
      }

      return {
        distance: {
          text: element.distance.text,
          value: element.distance.value,
        },
        duration: {
          text: element.duration.text,
          value: element.duration.value,
        },
        status: element.status,
      }
    } catch (error) {
      console.error("Distance Matrix API Error:", error.response?.data || error.message)
      throw new Error("Failed to calculate distance")
    }
  }
}

module.exports = GoogleMapsService