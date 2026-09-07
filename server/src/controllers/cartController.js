const {
  addCartItem,
  getCartItemsByUserId,
  getCartItemById,
  updateCartItemQuantity,
  removeCartItem,
} = require('../models/cartModel');

const VALID_TYPES = ['flight', 'hotel', 'bus', 'package'];

async function addToCart(req, res) {
  try {
    const { itemType, itemId, quantity, details } = req.body;

    if (!VALID_TYPES.includes(itemType)) {
      return res.status(400).json({ error: 'itemType must be one of: flight, hotel, bus, package' });
    }
    if (!itemId) {
      return res.status(400).json({ error: 'itemId is required' });
    }

    const result = await addCartItem({
      userId: req.user.id,
      itemType,
      itemId,
      quantity: quantity || 1,
      details,
    });

    if (result.error === 'ITEM_NOT_FOUND') {
      return res.status(404).json({ error: `No ${itemType} found with that id` });
    }
    if (result.error === 'INVALID_ITEM_TYPE') {
      return res.status(400).json({ error: 'Invalid item type' });
    }

    res.status(201).json({ cartItem: result.cartItem });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not add item to cart' });
  }
}

async function getCart(req, res) {
  try {
    const items = await getCartItemsByUserId(req.user.id);
    res.json({ items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load cart' });
  }
}

async function updateQuantity(req, res) {
  try {
    const { quantity } = req.body;
    if (!quantity || quantity < 1) {
      return res.status(400).json({ error: 'A valid quantity is required' });
    }

    const existing = await getCartItemById(req.params.id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: 'Cart item not found' });
    }

    const updated = await updateCartItemQuantity(req.params.id, req.user.id, quantity);
    res.json({ cartItem: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update cart item' });
  }
}

async function removeFromCart(req, res) {
  try {
    const removed = await removeCartItem(req.params.id, req.user.id);
    if (!removed) {
      return res.status(404).json({ error: 'Cart item not found' });
    }
    res.json({ removed: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not remove cart item' });
  }
}

module.exports = { addToCart, getCart, updateQuantity, removeFromCart };
