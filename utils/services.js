const rideModel = require("../models/ride");

//start ride after verify with opt

module.exports.startRide = async ({ rideId, otp, driverId  }) => {
  console.log(rideId, otp, driverId, "====in service folder");
  if (!rideId || !otp) {
    throw new Error("Ride id and OTP are required");
  }

  const ride = await rideModel
    .findOne({
      _id: rideId,
    })
    .populate("user", "_id socketId");
  // .populate('driver').select('+OTPForStartRide');

  if (!ride) {
    throw new Error("Ride not found");
  }
  if (ride.status !== "accepted") {
    throw new Error("Ride not accepted");
  }
   if (!ride.driver || String(ride.driver) !== String(driverId))
      throw new Error("Not authorized for this ride" )

  if (ride.OTPForStartRide !== parseInt(otp)) {
    throw new Error("Invalid OTP");
  }

  await rideModel.findOneAndUpdate(
    {
      _id: rideId,
    },
    {
      status: "started",
      "timeline.startedAt": new Date(),
    },
    { new: true }
  );

  return ride;
};