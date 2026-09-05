const express = require('express');
const router = express.Router();
const { initiateCheckout, handleWebhook } = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');
const { initiateHotelCheckout } = require('../controllers/hotelPaymentController');

const { initiateBusCheckout } = require('../controllers/busPaymentController');
const { initiatePackageCheckout } = require('../controllers/packagePaymentController');


router.post('/checkout', protect, initiateCheckout);
router.post('/hotels/checkout', protect, initiateHotelCheckout);
router.post('/webhook', handleWebhook); // Razorpay calls this — no auth middleware, verified by signature instead
router.post('/buses/checkout', protect, initiateBusCheckout);
router.post('/packages/checkout', protect, initiatePackageCheckout);

module.exports = router;