const admin = require("firebase-admin");
const userModel = require("../models/user");

// Initialize Firebase Admin once
if (!admin.apps.length) {
  const serviceAccount = require("../firebaseService.json");

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log("Firebase Admin Initialized");
}

exports.pushNotification = async (userIds, message) => {
  try {
    console.log("Incoming User IDs:", userIds);
    console.log("Message:", message);

    // Fetch FCM tokens
    const users = await userModel
      .find({ _id: { $in: userIds } })
      .select({ fcmToken: 1 });

    const tokens = users
      .map((u) => u.userToken)
      .filter((token) => token && token.trim() !== "");

    if (!tokens.length) {
      console.log("No valid FCM tokens found.");
      return;
    }

    console.log("Valid Tokens:", tokens);

    // Notification data (works for both Android/iOS)
    const payload = {
      notification: {
        title: "Vezoh",
        body: message,
      },
    };

    // SEND MULTICAST (Correct for firebase-admin v13+)
    const response = await admin.messaging().sendEachForMulticast({
      tokens: tokens,
      ...payload,
    });

    console.log("Notification Sent:", response);
  } catch (error) {
    console.error("❌ Push Notification Error:", error);
  }
};
