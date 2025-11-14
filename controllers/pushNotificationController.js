 const {pushNotification} = require("../utils/pushNotification");

exports.sendPushNotifications = async (req, res) => {
  try {
    const { userIds, message } = req.body;  
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, message: "userIds must be a non-empty array" });
    }
    if (!message || typeof message !== "string") {
      return res.status(400).json({ success: false, message: "message is required and must be a string" });
    }
   
    await pushNotification(userIds, message);
    res.json({ success: true, message: "Push notification sent successfully" });
  } catch (error) {
    console.error("Error sending push notification:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};   