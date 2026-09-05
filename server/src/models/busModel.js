const pool = require('../config/db');

async function searchBuses({ origin, destination, date }) {
  const conditions = [];
  const params = [];

  if (origin) {
    params.push(`%${origin}%`);
    conditions.push(`origin ILIKE $${params.length}`);
  }
  if (destination) {
    params.push(`%${destination}%`);
    conditions.push(`destination ILIKE $${params.length}`);
  }
  if (date) {
    params.push(date);
    conditions.push(`departure_time::date = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query(`SELECT * FROM buses ${where} ORDER BY departure_time ASC`, params);
  return result.rows;
}

async function createBusBooking({ userId, busId, seatsRequested, couponCode }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const busResult = await client.query('SELECT * FROM buses WHERE id = $1 FOR UPDATE', [busId]);
    const bus = busResult.rows[0];
    if (!bus) {
      await client.query('ROLLBACK');
      return { error: 'BUS_NOT_FOUND' };
    }
    if (bus.available_seats < seatsRequested) {
      await client.query('ROLLBACK');
      return { error: 'NOT_ENOUGH_SEATS', available: bus.available_seats };
    }

    let totalPrice = bus.seat_price * seatsRequested;
    let appliedCouponCode = null;

    if (couponCode) {
      const couponResult = await client.query('SELECT * FROM coupons WHERE code = $1 FOR UPDATE', [couponCode]);
      const coupon = couponResult.rows[0];
      const now = new Date();

      if (!coupon || !coupon.is_active) {
        await client.query('ROLLBACK');
        return { error: 'COUPON_INVALID' };
      }
      if (coupon.valid_from && now < new Date(coupon.valid_from)) {
        await client.query('ROLLBACK');
        return { error: 'COUPON_NOT_YET_VALID' };
      }
      if (coupon.valid_until && now > new Date(coupon.valid_until)) {
        await client.query('ROLLBACK');
        return { error: 'COUPON_EXPIRED' };
      }
      if (totalPrice < coupon.min_order_amount) {
        await client.query('ROLLBACK');
        return { error: 'COUPON_MIN_ORDER_NOT_MET', minOrderAmount: coupon.min_order_amount };
      }
      if (coupon.max_uses !== null && coupon.uses_count >= coupon.max_uses) {
        await client.query('ROLLBACK');
        return { error: 'COUPON_LIMIT_REACHED' };
      }

      const discount = coupon.discount_type === 'percent'
        ? totalPrice * (Number(coupon.discount_value) / 100)
        : Number(coupon.discount_value);
      totalPrice = Math.max(0, totalPrice - discount);

      await client.query('UPDATE coupons SET uses_count = uses_count + 1 WHERE id = $1', [coupon.id]);
      appliedCouponCode = coupon.code;
    }

    await client.query('UPDATE buses SET available_seats = available_seats - $1 WHERE id = $2', [seatsRequested, busId]);

    const bookingResult = await client.query(
      `INSERT INTO bus_bookings (user_id, bus_id, seats_booked, total_price, status, coupon_code)
       VALUES ($1, $2, $3, $4, 'pending', $5)
       RETURNING *`,
      [userId, busId, seatsRequested, totalPrice, appliedCouponCode]
    );

    await client.query('COMMIT');
    return { booking: bookingResult.rows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function createBusBookingWithWallet({ userId, busId, seatsRequested }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const busResult = await client.query('SELECT * FROM buses WHERE id = $1 FOR UPDATE', [busId]);
    const bus = busResult.rows[0];
    if (!bus) {
      await client.query('ROLLBACK');
      return { error: 'BUS_NOT_FOUND' };
    }
    if (bus.available_seats < seatsRequested) {
      await client.query('ROLLBACK');
      return { error: 'NOT_ENOUGH_SEATS', available: bus.available_seats };
    }

    const totalPrice = bus.seat_price * seatsRequested;

    const userResult = await client.query('SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const currentBalance = userResult.rows[0].wallet_balance;
    if (currentBalance < totalPrice) {
      await client.query('ROLLBACK');
      return { error: 'INSUFFICIENT_BALANCE', balance: currentBalance, required: totalPrice };
    }

    const newBalance = currentBalance - totalPrice;

    await client.query('UPDATE buses SET available_seats = available_seats - $1 WHERE id = $2', [seatsRequested, busId]);
    await client.query('UPDATE users SET wallet_balance = $1 WHERE id = $2', [newBalance, userId]);

    const bookingResult = await client.query(
      `INSERT INTO bus_bookings (user_id, bus_id, seats_booked, total_price, status)
       VALUES ($1, $2, $3, $4, 'confirmed')
       RETURNING *`,
      [userId, busId, seatsRequested, totalPrice]
    );
    const booking = bookingResult.rows[0];

    await client.query(
      `INSERT INTO bus_payments (booking_id, razorpay_order_id, amount, status, payment_method)
       VALUES ($1, NULL, $2, 'paid', 'wallet')`,
      [booking.id, totalPrice]
    );

    await client.query(
      `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, reason, reference_id)
       VALUES ($1, 'debit', $2, $3, 'bus_booking_payment', $4)`,
      [userId, totalPrice, newBalance, booking.id]
    );

    await client.query('COMMIT');
    return { booking, newBalance };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getBusBookingsByUserId(userId) {
  const result = await pool.query(
    `SELECT
       bb.id, bb.seats_booked, bb.total_price, bb.status, bb.created_at,
       b.operator, b.bus_number, b.bus_type, b.origin, b.destination, b.departure_time, b.arrival_time,
       p.status AS payment_status, p.razorpay_payment_id
     FROM bus_bookings bb
     JOIN buses b ON b.id = bb.bus_id
     LEFT JOIN bus_payments p ON p.booking_id = bb.id
     WHERE bb.user_id = $1
     ORDER BY bb.created_at DESC`,
    [userId]
  );
  return result.rows;
}

async function cancelBusBooking({ bookingId, userId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `SELECT bb.*, b.departure_time, b.id AS bus_id
       FROM bus_bookings bb
       JOIN buses b ON b.id = bb.bus_id
       WHERE bb.id = $1
       FOR UPDATE`,
      [bookingId]
    );

    const booking = result.rows[0];
    if (!booking) {
      await client.query('ROLLBACK');
      return { error: 'NOT_FOUND' };
    }
    if (booking.user_id !== userId) {
      await client.query('ROLLBACK');
      return { error: 'FORBIDDEN' };
    }
    if (!['pending', 'confirmed'].includes(booking.status)) {
      await client.query('ROLLBACK');
      return { error: 'INVALID_STATUS', currentStatus: booking.status };
    }

    const hoursUntilDeparture = (new Date(booking.departure_time) - new Date()) / 3600000;
    if (hoursUntilDeparture < 2) {
      await client.query('ROLLBACK');
      return { error: 'TOO_LATE' };
    }

    const wasConfirmed = booking.status === 'confirmed';

    await client.query(`UPDATE bus_bookings SET status = 'cancelled' WHERE id = $1`, [bookingId]);
    await client.query(
      `UPDATE buses SET available_seats = available_seats + $1 WHERE id = $2`,
      [booking.seats_booked, booking.bus_id]
    );

    await client.query('COMMIT');
    return { booking: { ...booking, status: 'cancelled' }, needsRefund: wasConfirmed };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function releaseExpiredPendingBusBookings(olderThanMinutes = 15) {
  const client = await pool.connect();
  let releasedCount = 0;
  try {
    const candidates = await client.query(
      `SELECT id, bus_id, seats_booked
       FROM bus_bookings
       WHERE status = 'pending'
         AND created_at < now() - ($1 || ' minutes')::interval`,
      [olderThanMinutes]
    );

    for (const booking of candidates.rows) {
      try {
        await client.query('BEGIN');
        const current = await client.query(
          `SELECT status FROM bus_bookings WHERE id = $1 FOR UPDATE`,
          [booking.id]
        );
        if (current.rows[0]?.status !== 'pending') {
          await client.query('ROLLBACK');
          continue;
        }
        await client.query(
          `UPDATE buses SET available_seats = available_seats + $1 WHERE id = $2`,
          [booking.seats_booked, booking.bus_id]
        );
        await client.query(`UPDATE bus_bookings SET status = 'expired' WHERE id = $1`, [booking.id]);
        await client.query(
          `UPDATE bus_payments SET status = 'failed' WHERE booking_id = $1 AND status = 'created'`,
          [booking.id]
        );
        await client.query('COMMIT');
        releasedCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Failed to release bus booking ${booking.id}:`, err);
      }
    }
    return { releasedCount, scanned: candidates.rows.length };
  } finally {
    client.release();
  }
}

module.exports = {
  searchBuses,
  createBusBooking,
  createBusBookingWithWallet,
  getBusBookingsByUserId,
  cancelBusBooking,
  releaseExpiredPendingBusBookings,
};