const crypto = require("crypto")

// Generate unique booking ID
const generateBookingId = () => {
  const timestamp = Date.now().toString()
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `VZ${timestamp.slice(-6)}${random}`
}

// Generate unique transaction ID
const generateTransactionId = () => {
  const timestamp = Date.now().toString()
  const random = Math.random().toString(36).substring(2, 10).toUpperCase()
  return `TXN${timestamp.slice(-8)}${random}`
}

// Calculate distance between two coordinates (Haversine formula)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371 // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c
  return Math.round(distance * 100) / 100 // Round to 2 decimal places
}

// Calculate fare based on distance and service type
const calculateFare = (distance, serviceType, vehicleType) => {
  const baseFares = {
    ride: { bike: 25, auto: 35, car: 50 },
    delivery: { bike: 20, auto: 30, car: 40 },
    freight: { truck: 100 },
  }

  const perKmRates = {
    ride: { bike: 8, auto: 12, car: 15 },
    delivery: { bike: 6, auto: 10, car: 12 },
    freight: { truck: 25 },
  }

  const baseFare = baseFares[serviceType][vehicleType] || 50
  const distanceFare = (perKmRates[serviceType][vehicleType] || 10) * distance
  const serviceFee = Math.round((baseFare + distanceFare) * 0.1) // 10% service fee
  const taxes = Math.round((baseFare + distanceFare + serviceFee) * 0.05) // 5% tax

  const total = baseFare + distanceFare + serviceFee + taxes

  return {
    baseFare,
    distanceFare: Math.round(distanceFare),
    serviceFee,
    taxes,
    total: Math.round(total),
  }
}

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Format phone number
const formatPhoneNumber = (phone) => {
  // Remove all non-digits
  const cleaned = phone.replace(/\D/g, "")

  // Add country code if not present
  if (cleaned.length === 10) {
    return `+91${cleaned}`
  } else if (cleaned.length === 12 && cleaned.startsWith("91")) {
    return `+${cleaned}`
  }

  return phone
}

// Validate email
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Validate phone number
const isValidPhone = (phone) => {
  const phoneRegex = /^(\+91|91)?[6-9]\d{9}$/
  return phoneRegex.test(phone.replace(/\s/g, ""))
}

module.exports = {
  generateBookingId,
  generateTransactionId,
  calculateDistance,
  calculateFare,
  generateOTP,
  formatPhoneNumber,
  isValidEmail,
  isValidPhone,
}
