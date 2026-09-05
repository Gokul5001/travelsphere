// server/src/routes/walletRoutes.js
const express = require('express');
const router = express.Router();
const { getWallet, initiateTopup } = require('../controllers/walletController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getWallet);
router.post('/topup', protect, initiateTopup);

module.exports = router;