const pool = require('../config/db');

async function createRefundRecord({ paymentId, bookingId, razorpayRefundId, amount, status, failureReason }) {
  const result = await pool.query(
    `INSERT INTO refunds (payment_id, booking_id, razorpay_refund_id, amount, status, failure_reason)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [paymentId, bookingId, razorpayRefundId ?? null, amount, status, failureReason ?? null]
  );
  return result.rows[0];
}

async function markRefundProcessed(razorpayRefundId) {
  const result = await pool.query(
    `UPDATE refunds SET status = 'processed', updated_at = now()
     WHERE razorpay_refund_id = $1 AND status != 'processed'
     RETURNING *`,
    [razorpayRefundId]
  );
  return result.rows[0]; // undefined if already processed — idempotent no-op
}

async function getFailedRefunds() {
    const result = await pool.query(
      `SELECT r.*, p.razorpay_payment_id
       FROM refunds r
       JOIN payments p ON p.id = r.payment_id
       WHERE r.status = 'failed'`
    );
    return result.rows;
  }

async function markRefundFailed(refundId, reason) {
  await pool.query(
    `UPDATE refunds SET status = 'failed', failure_reason = $1, updated_at = now() WHERE id = $2`,
    [reason, refundId]
  );
}

async function markRefundInitiated(refundId, razorpayRefundId) {
  await pool.query(
    `UPDATE refunds SET status = 'initiated', razorpay_refund_id = $1, failure_reason = NULL, updated_at = now() WHERE id = $2`,
    [razorpayRefundId, refundId]
  );
}

module.exports = {
  createRefundRecord,
  markRefundProcessed,
  getFailedRefunds,
  markRefundFailed,
  markRefundInitiated,
};