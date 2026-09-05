// server/src/routes/bookingRoutes.js
const express = require('express');
const router = express.Router();
const { cancel, bookWithWallet  } = require('../controllers/bookingController');
const { protect } = require('../middleware/authMiddleware');

router.post('/:id/cancel', protect, cancel);
router.post('/pay-with-wallet', protect, bookWithWallet);

module.exports = router;