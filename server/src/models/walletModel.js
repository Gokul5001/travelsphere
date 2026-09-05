const pool = require('../config/db');

async function getWalletSummary(userId) {
  const balanceResult = await pool.query(
    `SELECT wallet_balance FROM users WHERE id = $1`,
    [userId]
  );
  const txResult = await pool.query(
    `SELECT * FROM wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [userId]
  );
  return {
    balance: balanceResult.rows[0]?.wallet_balance ?? 0,
    transactions: txResult.rows,
  };
}

async function createTopupRecord({ userId, razorpayOrderId, amount }) {
  const result = await pool.query(
    `INSERT INTO wallet_topups (user_id, razorpay_order_id, amount, status)
     VALUES ($1, $2, $3, 'created')
     RETURNING *`,
    [userId, razorpayOrderId, amount]
  );
  return result.rows[0];
}

// Called from the payment.captured webhook when the order isn't a booking payment
async function creditWalletFromTopup(orderId, razorpayPaymentId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const topupResult = await client.query(
      `SELECT * FROM wallet_topups WHERE razorpay_order_id = $1 FOR UPDATE`,
      [orderId]
    );
    const topup = topupResult.rows[0];
    if (!topup) {
      await client.query('ROLLBACK');
      return { error: 'TOPUP_NOT_FOUND' };
    }
    if (topup.status === 'paid') {
      await client.query('ROLLBACK');
      return { alreadyProcessed: true };
    }

    await client.query(
      `UPDATE wallet_topups SET status = 'paid', razorpay_payment_id = $1, updated_at = now() WHERE id = $2`,
      [razorpayPaymentId, topup.id]
    );

    const userResult = await client.query(
      `UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2 RETURNING wallet_balance`,
      [topup.amount, topup.user_id]
    );
    const newBalance = userResult.rows[0].wallet_balance;

    await client.query(
      `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, reason, reference_id)
       VALUES ($1, 'credit', $2, $3, 'topup', $4)`,
      [topup.user_id, topup.amount, newBalance, topup.id]
    );

    await client.query('COMMIT');
    return { newBalance };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}


async function creditWalletRefund({ userId, bookingId, amount }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      `UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2 RETURNING wallet_balance`,
      [amount, userId]
    );
    const newBalance = userResult.rows[0].wallet_balance;

    await client.query(
      `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, reason, reference_id)
       VALUES ($1, 'credit', $2, $3, 'booking_refund', $4)`,
      [userId, amount, newBalance, bookingId]
    );

    await client.query('COMMIT');
    return { newBalance };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { getWalletSummary, createTopupRecord, creditWalletFromTopup, creditWalletRefund };

