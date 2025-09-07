const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth.js");
const { param, body } = require("express-validator");
const {
  servicesList,
  particularService,
  addServices,
  driverServices,
} = require("../controllers/serviceController.js");
const { throwError } = require("../middleware/errorMiddleware.js");

router.post("/services/add-services", addServices);
router.post(
  "/driver-services",
  auth,
  body("services")
    .trim()
    .notEmpty()
    .withMessage("Please select some services")
    .bail()
    .isArray()
    .withMessage("Invalid format of service selection.")
    .bail()
    .custom((value) => {
      if (!value.length) {
        throw new Error("Please select some services");
      }
      for (let ele of value) {
        if (!["ride", "courier", "freight"].includes(ele)) {
          throw new Error("Invalid value in service selection");
        }
      }
      return true;
    }),
  throwError,
  driverServices
);

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
