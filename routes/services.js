const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth.js");
const { param } = require("express-validator");
const {
  servicesList,
  particularService,
  addServices,
} = require("../controllers/serviceController.js");
const { throwError } = require("../middleware/errorMiddleware.js");

router.post("/services/add-services", addServices);

router.get("/services", auth, servicesList);

router.get(
  "/services/:service",
  auth,
  param("service")
    .trim()
    .notEmpty()
    .withMessage("service is required")
    .bail()
    .not()
    .isInt()
    .withMessage("Invalid service selection"),
  throwError,
  particularService
);

module.exports = router;
