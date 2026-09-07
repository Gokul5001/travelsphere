const express = require('express');
const router = express.Router();
const { addToCart, getCart, updateQuantity, removeFromCart } = require('../controllers/cartController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect); // every cart route requires login

router.get('/', getCart);
router.post('/', addToCart);
router.patch('/:id', updateQuantity);
router.delete('/:id', removeFromCart);

module.exports = router;
