const express = require("express");
const { createUser, getUsers } = require("../controllers/userController");
// const { createDriver} = require("../controllers/driverController");
const validate = require("../middleware/validate");
const { userSchema } = require("../validators/userValidator");
// const { registerDriverSchema } = require("../validators/driverValidator");

const router = express.Router();

router.post("/", validate(userSchema), createUser);
router.get("/", getUsers);
// router.post("/driver/register", validate(registerDriverSchema), createDriver);

module.exports = router;
