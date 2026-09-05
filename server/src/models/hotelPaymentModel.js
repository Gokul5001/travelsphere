const pool = require('../config/db');

async function createHotelPaymentRecord({ bookingId, razorpayOrderId, amount }) {
  const result = await pool.query(
    `INSERT INTO hotel_payments (booking_id, razorpay_order_id, amount, status)
     VALUES ($1, $2, $3, 'created')
     RETURNING *`,
    [bookingId, razorpayOrderId, amount]
  );
  return result.rows[0];
}

async function markHotelPaymentPaid(orderId, razorpayPaymentId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const paymentResult = await client.query(
      `SELECT * FROM hotel_payments WHERE razorpay_order_id = $1 FOR UPDATE`,
      [orderId]
    );
    const payment = paymentResult.rows[0];
    if (!payment) {
      await client.query('ROLLBACK');
      return { error: 'PAYMENT_NOT_FOUND' };
    }
    if (payment.status === 'paid') {
      await client.query('ROLLBACK');
      return { alreadyProcessed: true, payment };
    }
    const updated = await client.query(
      `UPDATE hotel_payments
       SET status = 'paid', razorpay_payment_id = $1, updated_at = now()
       WHERE razorpay_order_id = $2
       RETURNING *`,
      [razorpayPaymentId, orderId]
    );
    await client.query(`UPDATE hotel_bookings SET status = 'confirmed' WHERE id = $1`, [payment.booking_id]);
    await client.query('COMMIT');
    return { payment: updated.rows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function findPaidHotelPaymentByBookingId(bookingId) {
  const result = await pool.query(
    `SELECT * FROM hotel_payments WHERE booking_id = $1 AND status = 'paid'`,
    [bookingId]
  );
  return result.rows[0];
}

module.exports = { createHotelPaymentRecord, markHotelPaymentPaid, findPaidHotelPaymentByBookingId };