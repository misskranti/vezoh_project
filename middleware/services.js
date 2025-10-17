const rideModel = require('../models/ride');

//start ride after verify with opt

module.exports.startRide = async ({ rideId, otp, driver }) => {
    console.log(rideId, otp, driver,"====in service folder")
    if (!rideId || !otp) {
        throw new Error('Ride id and OTP are required');
    }

    const ride = await rideModel.findOne({
        _id: rideId
    }).populate("user", "_id socketId");
    // .populate('driver').select('+OTPForStartRide');

    if (!ride) {
        throw new Error('Ride not found');
    }
    if (ride.status !== 'accepted') {
        throw new Error('Ride not accepted');
    }

    if (ride.OTPForStartRide !== otp) {
        throw new Error('Invalid OTP');
    }

    await rideModel.findOneAndUpdate({
        _id: rideId
    }, {
        status: 'Started'
    },{new:true})

    return ride;
}