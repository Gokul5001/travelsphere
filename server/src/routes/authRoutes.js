const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/authController');
const { registerRules, loginRules, validate } = require('../middleware/validators');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', registerRules, validate, register);
router.post('/login', loginRules, validate, login);
router.get('/me', protect, getMe);

module.exports = router;