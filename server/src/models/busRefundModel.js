const pool = require('../config/db');

async function createBusRefundRecord({ paymentId, bookingId, razorpayRefundId, amount, status, failureReason }) {
  const result = await pool.query(
    `INSERT INTO bus_refunds (payment_id, booking_id, razorpay_refund_id, amount, status, failure_reason)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [paymentId, bookingId, razorpayRefundId ?? null, amount, status, failureReason ?? null]
  );
  return result.rows[0];
}

module.exports = { createBusRefundRecord };