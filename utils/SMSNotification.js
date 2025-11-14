// smsService.js
const twilio = require("twilio");

const accountSid = "YOUR_TWILIO_ACCOUNT_SID";
const authToken = "YOUR_TWILIO_AUTH_TOKEN";
const client = twilio(accountSid, authToken);

async function sendSMS(to, message) {
  try {
    const msg = await client.messages.create({
      body: message,
      from: "+1YOUR_TWILIO_PHONE_NUMBER",
      to: `+91${to}` // Indian number example
    });
    console.log("SMS sent:", msg.sid);
  } catch (err) {
    console.error("Error sending SMS:", err.message);
  }
}


module.exports = sendSMS;
