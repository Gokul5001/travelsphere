const pool = require('../config/db');

// NOTE: these three imports assume your hotel/bus/package models export a
// getXById function the same way flightModel exports getFlightById. If your
// actual export names differ, just adjust the requires below to match.
const { getFlightById } = require('./flightModel');
const { getHotelById } = require('./hotelModel');
const { getBusById } = require('./busModel');
const { getPackageById } = require('./packageModel');

const ITEM_FETCHERS = {
  flight: getFlightById,
  hotel: getHotelById,
  bus: getBusById,
  package: getPackageById,
};

async function addCartItem({ userId, itemType, itemId, quantity, details }) {
  const fetcher = ITEM_FETCHERS[itemType];
  if (!fetcher) {
    return { error: 'INVALID_ITEM_TYPE' };
  }

  const item = await fetcher(itemId);
  if (!item) {
    return { error: 'ITEM_NOT_FOUND' };
  }

  const result = await pool.query(
    `INSERT INTO cart_items (user_id, item_type, item_id, quantity, details)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, itemType, itemId, quantity || 1, JSON.stringify(details || {})]
  );

  return { cartItem: result.rows[0] };
}

async function getCartItemsByUserId(userId) {
  const result = await pool.query(
    `SELECT * FROM cart_items WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );

  // Enrich each row with the item's *current* details (price, availability,
  // name) so the cart never shows stale info from when it was added.
  const enriched = await Promise.all(
    result.rows.map(async (row) => {
      const fetcher = ITEM_FETCHERS[row.item_type];
      const item = fetcher ? await fetcher(row.item_id) : null;
      return { ...row, item };
    })
  );

  return enriched;
}

async function getCartItemById(id, userId) {
  const result = await pool.query(
    `SELECT * FROM cart_items WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return result.rows[0];
}

async function updateCartItemQuantity(id, userId, quantity) {
  const result = await pool.query(
    `UPDATE cart_items SET quantity = $1 WHERE id = $2 AND user_id = $3 RETURNING *`,
    [quantity, id, userId]
  );
  return result.rows[0];
}

async function removeCartItem(id, userId) {
  const result = await pool.query(
    `DELETE FROM cart_items WHERE id = $1 AND user_id = $2 RETURNING *`,
    [id, userId]
  );
  return result.rows[0];
}

async function clearCartForUser(userId) {
  await pool.query(`DELETE FROM cart_items WHERE user_id = $1`, [userId]);
}

module.exports = {
  addCartItem,
  getCartItemsByUserId,
  getCartItemById,
  updateCartItemQuantity,
  removeCartItem,
  clearCartForUser,
};
