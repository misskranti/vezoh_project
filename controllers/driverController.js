const Driver = require("../models/Driver");
const User = require("../models/Driver");

exports.createDriver = async (req, res) => {
    const { phonenumber, password, licenseNumber, vehicleNumber } = req.body;

    const user = new User({ phonenumber, password, role: "driver" });
    await user.save();

    const driver = new Driver({ user: user._id, licenseNumber, vehicleNumber });
    await driver.save();

    res.json({ message: "Driver created", driver, user });
};
