const mongoose = require("mongoose")
const Service = require("../models/service")
const path = require("path")

require("dotenv").config({ path: path.join(__dirname, "../.env") })

const services = [
  {
    serviceId: "ride",
    name: "Ride",
    description: "Book a ride to your destination",
    icon: "car",
    basePrice: 50,
    pricePerKm: 12,
    vehicleTypes: ["auto", "bike", "car"],
    features: ["GPS tracking", "Safe rides", "Quick booking"],
    estimatedTime: "5-10 mins",
    sortOrder: 1,
  },
  {
    serviceId: "courier",
    name: "Courier",
    description: "Send packages and documents",
    icon: "package",
    basePrice: 30,
    pricePerKm: 8,
    vehicleTypes: ["bike", "auto"],
    features: ["Same day delivery", "Package tracking", "Secure handling"],
    estimatedTime: "15-30 mins",
    sortOrder: 2,
  },
  {
    serviceId: "freight",
    name: "Freight",
    description: "Transport goods and cargo",
    icon: "truck",
    basePrice: 200,
    pricePerKm: 25,
    vehicleTypes: ["truck", "tempo", "mini-truck"],
    features: ["Heavy cargo", "Loading assistance", "Insurance coverage"],
    estimatedTime: "30-60 mins",
    sortOrder: 3,
  },
]

async function seedServices() {
  try {
    if (!process.env.MONGO_URI) {
      console.error("MONGO_URI environment variable is not set!")
      console.error("Please add MONGO_URI to your .env file")
      console.error("Example: MONGO_URI=mongodb://localhost:27017/vezoh")
      process.exit(1)
    }

    console.log("Connecting to MongoDB...")
    await mongoose.connect(process.env.MONGO_URI)
    console.log("Connected to MongoDB")

    await Service.deleteMany({})
    console.log("Cleared existing services")

    await Service.insertMany(services)
    console.log("Services seeded successfully!")
    console.log(`Inserted ${services.length} services: ${services.map((s) => s.name).join(", ")}`)

    process.exit(0)
  } catch (error) {
    console.error("Error seeding services:", error.message)
    process.exit(1)
  }
}

seedServices()
