// const { io } = require('socket.io-client');

// const socket = io('http://localhost:5000'); // your server URL

// socket.on('connect', () => {
//   console.log('Connected to server with ID:', socket.id);

//   // Join as a user
//   socket.emit('join', { userId: '6710b29a19b23c333b0342af', userType: 'user' });

//   // Or join as a driver
//   // socket.emit('join', { userId: '6710b29a19b23c333b0342af', userType: 'driver' });

//   // Send a location update for driver
//   socket.emit('update-location-driver', {
//     userId: '6710b29a19b23c333b0342af',
//     location: { ltd: 12.9716, lng: 77.5946 }
//   });
// });

// // Listen for any custom event from server
// socket.on('rideUpdate', (data) => {
//   console.log('Received rideUpdate:', data);
// });

// socket.on('error', (err) => {
//   console.log('Error from server:', err);
// });

// socket.on('disconnect', () => {
//   console.log('Disconnected from server');
// });


// const { io } = require('socket.io-client');
// const socket = io('http://localhost:5000', { transports: ['websocket'] });

// socket.on('connect', () => {
//   console.log('📱 User connected:', socket.id);
//   socket.emit('join', { userId: '68dc0e7ffa9f00ccd2f72880', userType: 'user' });
// });

// // Listen for driver location updates
// socket.on('driver-location-update', (data) => {
//   console.log('📍 Driver location received:', data);
// });

//---------ride confirmed -------------
const io = require("socket.io-client");

// Connect to your backend socket
const socket = io("http://localhost:5000", {
  transports: ["websocket"]
});

socket.on("connect", () => {
  console.log("Connected to socket server:", socket.id);
});

socket.on("ride-confirmed", (data) => {
  console.log("✅ Ride confirmed received from backend:", data);
});
