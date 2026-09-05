const pool = require('../config/db');

async function searchHotels({ city }) {
  const conditions = [];
  const params = [];

  if (city) {
    params.push(`%${city}%`);
    conditions.push(`city ILIKE $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query(`SELECT * FROM hotels ${where} ORDER BY price_per_night ASC`, params);
  return result.rows;
}

function nightsBetween(checkIn, checkOut) {
  const ms = new Date(checkOut) - new Date(checkIn);
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

async function createHotelBooking({ userId, hotelId, checkIn, checkOut, roomsRequested, couponCode }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const hotelResult = await client.query('SELECT * FROM hotels WHERE id = $1 FOR UPDATE', [hotelId]);
    const hotel = hotelResult.rows[0];
    if (!hotel) {
      await client.query('ROLLBACK');
      return { error: 'HOTEL_NOT_FOUND' };
    }
    if (hotel.available_rooms < roomsRequested) {
      await client.query('ROLLBACK');
      return { error: 'NOT_ENOUGH_ROOMS', available: hotel.available_rooms };
    }

    const nights = nightsBetween(checkIn, checkOut);
    let totalPrice = hotel.price_per_night * roomsRequested * nights;
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

    await client.query('UPDATE hotels SET available_rooms = available_rooms - $1 WHERE id = $2', [roomsRequested, hotelId]);

    const bookingResult = await client.query(
      `INSERT INTO hotel_bookings (user_id, hotel_id, check_in, check_out, rooms_booked, total_price, status, coupon_code)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
       RETURNING *`,
      [userId, hotelId, checkIn, checkOut, roomsRequested, totalPrice, appliedCouponCode]
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

async function createHotelBookingWithWallet({ userId, hotelId, checkIn, checkOut, roomsRequested }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const hotelResult = await client.query('SELECT * FROM hotels WHERE id = $1 FOR UPDATE', [hotelId]);
    const hotel = hotelResult.rows[0];
    if (!hotel) {
      await client.query('ROLLBACK');
      return { error: 'HOTEL_NOT_FOUND' };
    }
    if (hotel.available_rooms < roomsRequested) {
      await client.query('ROLLBACK');
      return { error: 'NOT_ENOUGH_ROOMS', available: hotel.available_rooms };
    }

    const nights = nightsBetween(checkIn, checkOut);
    const totalPrice = hotel.price_per_night * roomsRequested * nights;

    const userResult = await client.query('SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const currentBalance = userResult.rows[0].wallet_balance;
    if (currentBalance < totalPrice) {
      await client.query('ROLLBACK');
      return { error: 'INSUFFICIENT_BALANCE', balance: currentBalance, required: totalPrice };
    }

    const newBalance = currentBalance - totalPrice;

    await client.query('UPDATE hotels SET available_rooms = available_rooms - $1 WHERE id = $2', [roomsRequested, hotelId]);
    await client.query('UPDATE users SET wallet_balance = $1 WHERE id = $2', [newBalance, userId]);

    const bookingResult = await client.query(
      `INSERT INTO hotel_bookings (user_id, hotel_id, check_in, check_out, rooms_booked, total_price, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'confirmed')
       RETURNING *`,
      [userId, hotelId, checkIn, checkOut, roomsRequested, totalPrice]
    );
    const booking = bookingResult.rows[0];

    await client.query(
      `INSERT INTO hotel_payments (booking_id, razorpay_order_id, amount, status, payment_method)
       VALUES ($1, NULL, $2, 'paid', 'wallet')`,
      [booking.id, totalPrice]
    );

    await client.query(
      `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, reason, reference_id)
       VALUES ($1, 'debit', $2, $3, 'hotel_booking_payment', $4)`,
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

async function getHotelBookingsByUserId(userId) {
  const result = await pool.query(
    `SELECT
       hb.id, hb.check_in, hb.check_out, hb.rooms_booked, hb.total_price, hb.status, hb.created_at,
       h.name AS hotel_name, h.city, h.address,
       p.status AS payment_status, p.razorpay_payment_id
     FROM hotel_bookings hb
     JOIN hotels h ON h.id = hb.hotel_id
     LEFT JOIN hotel_payments p ON p.booking_id = hb.id
     WHERE hb.user_id = $1
     ORDER BY hb.created_at DESC`,
    [userId]
  );
  return result.rows;
}

async function cancelHotelBooking({ bookingId, userId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `SELECT hb.*, h.id AS hotel_id
       FROM hotel_bookings hb
       JOIN hotels h ON h.id = hb.hotel_id
       WHERE hb.id = $1
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

    const hoursUntilCheckIn = (new Date(booking.check_in) - new Date()) / 3600000;
    if (hoursUntilCheckIn < 24) {
      await client.query('ROLLBACK');
      return { error: 'TOO_LATE' };
    }

    const wasConfirmed = booking.status === 'confirmed';

    await client.query(`UPDATE hotel_bookings SET status = 'cancelled' WHERE id = $1`, [bookingId]);
    await client.query(
      `UPDATE hotels SET available_rooms = available_rooms + $1 WHERE id = $2`,
      [booking.rooms_booked, booking.hotel_id]
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

async function releaseExpiredPendingHotelBookings(olderThanMinutes = 15) {
  const client = await pool.connect();
  let releasedCount = 0;
  try {
    const candidates = await client.query(
      `SELECT id, hotel_id, rooms_booked
       FROM hotel_bookings
       WHERE status = 'pending'
         AND created_at < now() - ($1 || ' minutes')::interval`,
      [olderThanMinutes]
    );

    for (const booking of candidates.rows) {
      try {
        await client.query('BEGIN');
        const current = await client.query(
          `SELECT status FROM hotel_bookings WHERE id = $1 FOR UPDATE`,
          [booking.id]
        );
        if (current.rows[0]?.status !== 'pending') {
          await client.query('ROLLBACK');
          continue;
        }
        await client.query(
          `UPDATE hotels SET available_rooms = available_rooms + $1 WHERE id = $2`,
          [booking.rooms_booked, booking.hotel_id]
        );
        await client.query(`UPDATE hotel_bookings SET status = 'expired' WHERE id = $1`, [booking.id]);
        await client.query(
          `UPDATE hotel_payments SET status = 'failed' WHERE booking_id = $1 AND status = 'created'`,
          [booking.id]
        );
        await client.query('COMMIT');
        releasedCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Failed to release hotel booking ${booking.id}:`, err);
      }
    }
    return { releasedCount, scanned: candidates.rows.length };
  } finally {
    client.release();
  }
}

module.exports = {
  searchHotels,
  createHotelBooking,
  createHotelBookingWithWallet,
  getHotelBookingsByUserId,
  cancelHotelBooking,
  releaseExpiredPendingHotelBookings,
};