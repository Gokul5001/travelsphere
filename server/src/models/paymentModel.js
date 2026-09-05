const pool = require('../config/db');

async function createPaymentRecord({ bookingId, razorpayOrderId, amount }) {
  const result = await pool.query(
    `INSERT INTO payments (booking_id, razorpay_order_id, amount, status)
     VALUES ($1, $2, $3, 'created')
     RETURNING *`,
    [bookingId, razorpayOrderId, amount]
  );
  return result.rows[0];
}

async function findPaymentByOrderId(orderId) {
  const result = await pool.query(
    `SELECT * FROM payments WHERE razorpay_order_id = $1`,
    [orderId]
  );
  return result.rows[0];
}

async function markPaymentPaid(orderId, razorpayPaymentId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the payment row so concurrent webhook deliveries can't race each other
    const paymentResult = await client.query(
      `SELECT * FROM payments WHERE razorpay_order_id = $1 FOR UPDATE`,
      [orderId]
    );
    const payment = paymentResult.rows[0];

    if (!payment) {
      await client.query('ROLLBACK');
      return { error: 'PAYMENT_NOT_FOUND' };
    }

    // IDEMPOTENCY CHECK: if we've already processed this payment, do nothing
    if (payment.status === 'paid') {
      await client.query('ROLLBACK');
      return { alreadyProcessed: true, payment };
    }

    const updatedPayment = await client.query(
      `UPDATE payments
       SET status = 'paid', razorpay_payment_id = $1, updated_at = now()
       WHERE razorpay_order_id = $2
       RETURNING *`,
      [razorpayPaymentId, orderId]
    );

    await client.query(
      `UPDATE bookings SET status = 'confirmed' WHERE id = $1`,
      [payment.booking_id]
    );

    await client.query('COMMIT');
    return { payment: updatedPayment.rows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
async function findPaidPaymentByBookingId(bookingId) {
    const result = await pool.query(
      `SELECT * FROM payments WHERE booking_id = $1 AND status = 'paid'`,
      [bookingId]
    );
    return result.rows[0];
  }
  
  module.exports = { createPaymentRecord, findPaymentByOrderId, markPaymentPaid, findPaidPaymentByBookingId };