const sendSMS = require("../utils/SMSNotification");
const User = require("../models/UserModel");

//send SMS notification to a single user

exports.sendNotification = async (req, res) => {
  const { name, phone, senderName } = req.body;

  const message = `${senderName} sent you an item on OurApp`;

  await sendSMS(phone, message);

  res.json({ success: true, message: "SMS sent successfully" });
};

//send SMS notification to all users

exports.sendNotificationToAll = async (req, res) => {
  try {
    let { message } = req.body; // message from frontend

    if (!message) {
      return res.status(400).json({ success: false, message: "Message text is required" });
    }

    // Add your app name (Vezoh) automatically
    message = `Vezoh: ${message}`;

    const users = await User.find({ phone: { $exists: true, $ne: "" } });

    if (!users.length) {
      return res.status(404).json({ success: false, message: "No users with phone numbers found" });
    }

    const smsPromises = users.map(user => sendSMS(user.phone, message));
    await Promise.all(smsPromises);

    res.json({ success: true, message: `SMS sent to ${users.length} users` });
  } catch (error) {
    console.error("Error sending SMS:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}


