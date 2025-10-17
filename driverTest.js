const { io } = require('socket.io-client');
const socket = io('http://localhost:5000', { transports: ['websocket'] });

socket.on('connect', () => {
  console.log('🚗 Driver connected:', socket.id);

  socket.emit('join', { userId: '68e5d7b6c89c6d0b4677e139', userType: 'driver' });

  // Update location every 3 seconds
  let lat = 12.9716, lng = 77.5946;
  setInterval(() => {
    lat += 0.0003;
    lng += 0.0003;
    console.log('📤 Sending new location:', { ltd: lat, lng });
    socket.emit('update-location-driver', {
      userId: '68e5d7b6c89c6d0b4677e139',
      location: { ltd: lat, lng }
    });
  }, 3000);
});
