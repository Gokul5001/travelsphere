const express = require('express');
const router = express.Router();
const { search, bookFlight, myBookings } = require('../controllers/flightController');
const { protect } = require('../middleware/authMiddleware');

router.get('/search', search);            // public — anyone can search
router.post('/book', protect, bookFlight); // must be logged in to book
router.get('/my-bookings', protect, myBookings); // new

module.exports = router;