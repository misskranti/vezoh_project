const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth.js");
const { param, body } = require("express-validator");
const {driverOptServices,selectedServices,statusUpdate,driverdashboard,incomingrequest} = require("../controllers/driverController.js");

const {vehicleRegistration} = require("../controllers/vehicleController.js");

const { driverDocuments, handleUploadErrors } = require("../middleware/upload");

const { throwError } = require("../middleware/errorMiddleware.js");

router.post(
  "/opt-services",
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
  driverOptServices
);

router.get("/selected-services", auth, selectedServices);
router.post("/register-vehicle", auth, driverDocuments, handleUploadErrors, vehicleRegistration);
router.get("/dashboard", auth, driverdashboard);
router.patch(
  "/status-update",
  auth,
  
  statusUpdate
);
router.get("/incoming/:driverId", auth, incomingrequest);

module.exports = router;
