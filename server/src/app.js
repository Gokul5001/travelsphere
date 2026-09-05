const express = require('express');
const cors = require('cors');
require('./config/db');
const authRoutes = require('./routes/authRoutes');
const flightRoutes = require('./routes/flightRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const hotelRoutes = require('./routes/hotelRoutes');

const busRoutes = require('./routes/busRoutes');
const packageRoutes = require('./routes/packageRoutes');




const app = express();

app.use(cors());
app.use('/api/v1/payments/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());

app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/bookings', bookingRoutes);
app.use('/api/v1/wallet', require('./routes/walletRoutes'));
app.use('/api/v1/buses', busRoutes);
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/flights', flightRoutes);
app.use('/api/v1/hotels', hotelRoutes);
app.use('/api/v1/packages', packageRoutes);

module.exports = app;