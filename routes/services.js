const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth.js");
const { params } = require("express-validator");
const {
  servicesList,
  particularService,
  addServices,
} = require("../controllers/serviceController.js");

router.post("/services/add-services", addServices);

router.get("/services", auth, servicesList);

router.get("/services/:service", auth, particularService);

module.exports = router;
