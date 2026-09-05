const express = require('express');
const router = express.Router();
const { search, cancel, bookWithWallet, myBookings } = require('../controllers/busController');
const { protect } = require('../middleware/authMiddleware');

router.get('/search', search);
router.get('/my-bookings', protect, myBookings);
router.post('/:id/cancel', protect, cancel);
router.post('/pay-with-wallet', protect, bookWithWallet);

module.exports = router;