const pool = require('../config/db');

async function searchPackages({ destination }) {
  const conditions = [];
  const params = [];

  if (destination) {
    params.push(`%${destination}%`);
    conditions.push(`destination ILIKE $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query(`SELECT * FROM packages ${where} ORDER BY departure_date ASC`, params);
  return result.rows;
}

async function createPackageBooking({ userId, packageId, personsRequested, couponCode }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const pkgResult = await client.query('SELECT * FROM packages WHERE id = $1 FOR UPDATE', [packageId]);
    const pkg = pkgResult.rows[0];
    if (!pkg) {
      await client.query('ROLLBACK');
      return { error: 'PACKAGE_NOT_FOUND' };
    }
    if (pkg.available_slots < personsRequested) {
      await client.query('ROLLBACK');
      return { error: 'NOT_ENOUGH_SLOTS', available: pkg.available_slots };
    }

    let totalPrice = pkg.price_per_person * personsRequested;
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

    await client.query('UPDATE packages SET available_slots = available_slots - $1 WHERE id = $2', [personsRequested, packageId]);

    const bookingResult = await client.query(
      `INSERT INTO package_bookings (user_id, package_id, persons_booked, total_price, status, coupon_code)
       VALUES ($1, $2, $3, $4, 'pending', $5)
       RETURNING *`,
      [userId, packageId, personsRequested, totalPrice, appliedCouponCode]
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

async function createPackageBookingWithWallet({ userId, packageId, personsRequested }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const pkgResult = await client.query('SELECT * FROM packages WHERE id = $1 FOR UPDATE', [packageId]);
    const pkg = pkgResult.rows[0];
    if (!pkg) {
      await client.query('ROLLBACK');
      return { error: 'PACKAGE_NOT_FOUND' };
    }
    if (pkg.available_slots < personsRequested) {
      await client.query('ROLLBACK');
      return { error: 'NOT_ENOUGH_SLOTS', available: pkg.available_slots };
    }

    const totalPrice = pkg.price_per_person * personsRequested;

    const userResult = await client.query('SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const currentBalance = userResult.rows[0].wallet_balance;
    if (currentBalance < totalPrice) {
      await client.query('ROLLBACK');
      return { error: 'INSUFFICIENT_BALANCE', balance: currentBalance, required: totalPrice };
    }

    const newBalance = currentBalance - totalPrice;

    await client.query('UPDATE packages SET available_slots = available_slots - $1 WHERE id = $2', [personsRequested, packageId]);
    await client.query('UPDATE users SET wallet_balance = $1 WHERE id = $2', [newBalance, userId]);

    const bookingResult = await client.query(
      `INSERT INTO package_bookings (user_id, package_id, persons_booked, total_price, status)
       VALUES ($1, $2, $3, $4, 'confirmed')
       RETURNING *`,
      [userId, packageId, personsRequested, totalPrice]
    );
    const booking = bookingResult.rows[0];

    await client.query(
      `INSERT INTO package_payments (booking_id, razorpay_order_id, amount, status, payment_method)
       VALUES ($1, NULL, $2, 'paid', 'wallet')`,
      [booking.id, totalPrice]
    );

    await client.query(
      `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, reason, reference_id)
       VALUES ($1, 'debit', $2, $3, 'package_booking_payment', $4)`,
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

async function getPackageBookingsByUserId(userId) {
  const result = await pool.query(
    `SELECT
       pb.id, pb.persons_booked, pb.total_price, pb.status, pb.created_at,
       p.name AS package_name, p.destination, p.duration_days, p.departure_date,
       pay.status AS payment_status, pay.razorpay_payment_id
     FROM package_bookings pb
     JOIN packages p ON p.id = pb.package_id
     LEFT JOIN package_payments pay ON pay.booking_id = pb.id
     WHERE pb.user_id = $1
     ORDER BY pb.created_at DESC`,
    [userId]
  );
  return result.rows;
}

async function cancelPackageBooking({ bookingId, userId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `SELECT pb.*, p.departure_date, p.id AS package_id
       FROM package_bookings pb
       JOIN packages p ON p.id = pb.package_id
       WHERE pb.id = $1
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

    const hoursUntilDeparture = (new Date(booking.departure_date) - new Date()) / 3600000;
    if (hoursUntilDeparture < 48) {
      await client.query('ROLLBACK');
      return { error: 'TOO_LATE' };
    }

    const wasConfirmed = booking.status === 'confirmed';

    await client.query(`UPDATE package_bookings SET status = 'cancelled' WHERE id = $1`, [bookingId]);
    await client.query(
      `UPDATE packages SET available_slots = available_slots + $1 WHERE id = $2`,
      [booking.persons_booked, booking.package_id]
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

async function releaseExpiredPendingPackageBookings(olderThanMinutes = 15) {
  const client = await pool.connect();
  let releasedCount = 0;
  try {
    const candidates = await client.query(
      `SELECT id, package_id, persons_booked
       FROM package_bookings
       WHERE status = 'pending'
         AND created_at < now() - ($1 || ' minutes')::interval`,
      [olderThanMinutes]
    );

    for (const booking of candidates.rows) {
      try {
        await client.query('BEGIN');
        const current = await client.query(
          `SELECT status FROM package_bookings WHERE id = $1 FOR UPDATE`,
          [booking.id]
        );
        if (current.rows[0]?.status !== 'pending') {
          await client.query('ROLLBACK');
          continue;
        }
        await client.query(
          `UPDATE packages SET available_slots = available_slots + $1 WHERE id = $2`,
          [booking.persons_booked, booking.package_id]
        );
        await client.query(`UPDATE package_bookings SET status = 'expired' WHERE id = $1`, [booking.id]);
        await client.query(
          `UPDATE package_payments SET status = 'failed' WHERE booking_id = $1 AND status = 'created'`,
          [booking.id]
        );
        await client.query('COMMIT');
        releasedCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Failed to release package booking ${booking.id}:`, err);
      }
    }
    return { releasedCount, scanned: candidates.rows.length };
  } finally {
    client.release();
  }
}

module.exports = {
  searchPackages,
  createPackageBooking,
  createPackageBookingWithWallet,
  getPackageBookingsByUserId,
  cancelPackageBooking,
  releaseExpiredPendingPackageBookings,
};