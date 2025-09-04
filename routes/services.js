const express = require("express")
const router = express.Router()
const {auth} = require("../middleware/auth.js")
const { servicesList, particularService, addServices } = require("../controllers/serviceController.js")

router.post("/services/add-services", addServices)

router.get("/services", servicesList)

router.get("/services/:service", particularService)

module.exports = router
