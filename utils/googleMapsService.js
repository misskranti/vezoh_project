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

      if (element.status != "OK") {
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
        origin_addresses:response.data.origin_addresses?.[0] ,
        destination_addresses: response.data.destination_addresses?.[0],
        status: element.status,
      }
    } catch (error) {
      console.error("Distance Matrix API Error:", error.response?.data || error.message)
      throw new Error("Failed to calculate distance")
    }
  }

  static async getDirections(origin, destination, mode = "driving") {
    try {
      const res = await axios.get("https://maps.googleapis.com/maps/api/directions/json", {
        params: {
          origin: `${origin.lat},${origin.lng}`,
          destination: `${destination.lat},${destination.lng}`,
          key: process.env.GOOGLE_MAPS_API_KEY,
          mode,
          alternatives: false,
        },
      })
      const route = res.data.routes?.[0]
      if (!route) throw new Error("No route")
      const polyline = route.overview_polyline?.points
      const legs = route.legs?.[0]
      const totalDistanceMeters = legs?.distance?.value ?? route.distance?.value
      const totalDurationSec = legs?.duration?.value ?? route.duration?.value

      const points = polyline ? GoogleMapsService.decodePolyline(polyline) : []
      const waypoints = GoogleMapsService.withCumulativeDistances(points)

      const cap = Number(process.env.ROUTE_WAYPOINT_CAP) || 200
      const reduced = GoogleMapsService.reduceWaypoints(waypoints, cap)

      return { polyline, totalDistanceMeters, totalDurationSec, waypoints: reduced }
    } catch (err) {
      console.warn("Directions API error:", err.response?.data || err.message)
      return { polyline: null, totalDistanceMeters: null, totalDurationSec: null, waypoints: [] }
    }
  }

  static decodePolyline(str) {
    let index = 0,
      lat = 0,
      lng = 0,
      points = []
    while (index < str.length) {
      let b,
        shift = 0,
        result = 0
      do {
        b = str.charCodeAt(index++) - 63
        result |= (b & 0x1f) << shift
        shift += 5
      } while (b >= 0x20)
      const dlat = result & 1 ? ~(result >> 1) : result >> 1
      lat += dlat

      shift = 0
      result = 0
      do {
        b = str.charCodeAt(index++) - 63
        result |= (b & 0x1f) << shift
        shift += 5
      } while (b >= 0x20)
      const dlng = result & 1 ? ~(result >> 1) : result >> 1
      lng += dlng

      points.push({ lat: lat / 1e5, lng: lng / 1e5 })
    }
    return points
  }

  static haversineMeters(a, b) {
    if (!a || !b) return 0
    const R = 6371000
    const toRad = (d) => (d * Math.PI) / 180
    const dLat = toRad(b.lat - a.lat)
    const dLng = toRad(b.lng - a.lng)
    const lat1 = toRad(a.lat)
    const lat2 = toRad(b.lat)
    const sinDLat = Math.sin(dLat / 2)
    const sinDLng = Math.sin(dLng / 2)
    const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng
    return 2 * R * Math.asin(Math.sqrt(h))
  }

  static withCumulativeDistances(points) {
    const out = []
    let cum = 0
    for (let i = 0; i < points.length; i++) {
      if (i > 0) cum += GoogleMapsService.haversineMeters(points[i - 1], points[i])
      out.push({ ...points[i], cumDistMeters: cum })
    }
    return out
  }

  static reduceWaypoints(waypoints, maxPoints = 200) {
    if (!Array.isArray(waypoints) || waypoints.length <= maxPoints) return waypoints
    const count = Math.max(2, maxPoints)
    const step = (waypoints.length - 1) / (count - 1)
    const reduced = []
    for (let i = 0; i < count; i++) {
      const idx = Math.round(i * step)
      reduced.push(waypoints[Math.min(idx, waypoints.length - 1)])
    }
    // Ensure the final point is exactly the original last
    reduced[reduced.length - 1] = waypoints[waypoints.length - 1]
    return reduced
  }

  static computeTraveledDistanceMeters(point, waypoints) {
    if (!point || !waypoints?.length) return 0
    let best = { dist: Number.POSITIVE_INFINITY, traveled: 0 }

    for (let i = 0; i < waypoints.length - 1; i++) {
      const A = waypoints[i]
      const B = waypoints[i + 1]

      // vector projection of P onto segment AB
      const toRad = (d) => (d * Math.PI) / 180
      // approximate small-distance projection in lat/lng space by converting to meters
      const scaleLat = 111320 // meters per degree lat
      const scaleLng = 111320 * Math.cos(toRad((A.lat + B.lat) / 2))

      const Ax = 0,
        Ay = 0
      const Bx = (B.lng - A.lng) * scaleLng,
        By = (B.lat - A.lat) * scaleLat
      const Px = (point.lng - A.lng) * scaleLng,
        Py = (point.lat - A.lat) * scaleLat

      const denom = Bx * Bx + By * By || 1
      let t = (Px * Bx + Py * By) / denom
      t = Math.max(0, Math.min(1, t))

      const projX = Bx * t
      const projY = By * t
      const dx = Px - projX
      const dy = Py - projY
      const perp = Math.sqrt(dx * dx + dy * dy)

      const segLenMeters = GoogleMapsService.haversineMeters(A, B)
      const traveled = A.cumDistMeters + segLenMeters * t

      if (perp < best.dist) best = { dist: perp, traveled }
    }

    return best.traveled
  }

  static computeProgressPercent(point, waypoints, totalDistanceMeters) {
    if (!totalDistanceMeters || totalDistanceMeters <= 0 || !waypoints?.length) return 0
    const traveled = GoogleMapsService.computeTraveledDistanceMeters(point, waypoints)
    const pct = Math.max(0, Math.min(100, (traveled / totalDistanceMeters) * 100))
    return Math.round(pct)
  }
}

module.exports = GoogleMapsService