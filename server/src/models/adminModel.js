const pool = require('../config/db');

const BOOKINGS_UNION = `
  SELECT b.id, 'flight' AS item_type, b.user_id, u.full_name AS user_name, u.email AS user_email,
         (f.airline || ' ' || f.flight_number) AS item_label, b.seats_booked AS quantity,
         b.total_price, b.status, COALESCE(p.payment_method, 'razorpay') AS payment_method, b.created_at
  FROM bookings b
  JOIN flights f ON f.id = b.flight_id
  JOIN users u ON u.id = b.user_id
  LEFT JOIN payments p ON p.booking_id = b.id

  UNION ALL

  SELECT hb.id, 'hotel', hb.user_id, u.full_name, u.email,
         h.name AS item_label, hb.rooms_booked AS quantity,
         hb.total_price, hb.status, COALESCE(hp.payment_method, 'razorpay') AS payment_method, hb.created_at
  FROM hotel_bookings hb
  JOIN hotels h ON h.id = hb.hotel_id
  JOIN users u ON u.id = hb.user_id
  LEFT JOIN hotel_payments hp ON hp.booking_id = hb.id

  UNION ALL

  SELECT bb.id, 'bus', bb.user_id, u.full_name, u.email,
         (bus.operator || ' ' || bus.bus_number) AS item_label, bb.seats_booked AS quantity,
         bb.total_price, bb.status, COALESCE(bp.payment_method, 'razorpay') AS payment_method, bb.created_at
  FROM bus_bookings bb
  JOIN buses bus ON bus.id = bb.bus_id
  JOIN users u ON u.id = bb.user_id
  LEFT JOIN bus_payments bp ON bp.booking_id = bb.id

  UNION ALL

  SELECT pb.id, 'package', pb.user_id, u.full_name, u.email,
         pkg.name AS item_label, pb.persons_booked AS quantity,
         pb.total_price, pb.status, COALESCE(pp.payment_method, 'razorpay') AS payment_method, pb.created_at
  FROM package_bookings pb
  JOIN packages pkg ON pkg.id = pb.package_id
  JOIN users u ON u.id = pb.user_id
  LEFT JOIN package_payments pp ON pp.booking_id = pb.id
`;

const REVENUE_UNION = `
  SELECT amount FROM payments WHERE status = 'paid'
  UNION ALL
  SELECT amount FROM hotel_payments WHERE status = 'paid'
  UNION ALL
  SELECT amount FROM bus_payments WHERE status = 'paid'
  UNION ALL
  SELECT amount FROM package_payments WHERE status = 'paid'
`;

const FAILED_REFUNDS_UNION = `
  SELECT id FROM refunds WHERE status = 'failed'
  UNION ALL
  SELECT id FROM hotel_refunds WHERE status = 'failed'
  UNION ALL
  SELECT id FROM bus_refunds WHERE status = 'failed'
  UNION ALL
  SELECT id FROM package_refunds WHERE status = 'failed'
`;

async function getDashboardStats() {
  const [users, revenue, bookingCounts, pendingVisa, failedRefunds, walletTotal] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS count FROM users`),
    pool.query(`SELECT COALESCE(SUM(amount), 0)::float AS total FROM (${REVENUE_UNION}) t`),
    pool.query(`SELECT item_type, COUNT(*)::int AS count FROM (${BOOKINGS_UNION}) t GROUP BY item_type`),
    pool.query(`SELECT COUNT(*)::int AS count FROM visa_applications WHERE status IN ('submitted', 'under_review')`),
    pool.query(`SELECT COUNT(*)::int AS count FROM (${FAILED_REFUNDS_UNION}) t`),
    pool.query(`SELECT COALESCE(SUM(wallet_balance), 0)::float AS total FROM users`),
  ]);

  const byType = { flight: 0, hotel: 0, bus: 0, package: 0 };
  bookingCounts.rows.forEach((r) => { byType[r.item_type] = r.count; });

  return {
    totalUsers: users.rows[0].count,
    totalRevenue: revenue.rows[0].total,
    bookingsByType: byType,
    totalBookings: Object.values(byType).reduce((a, b) => a + b, 0),
    pendingVisaApplications: pendingVisa.rows[0].count,
    failedRefunds: failedRefunds.rows[0].count,
    totalWalletLiability: walletTotal.rows[0].total,
  };
}

async function getAllBookings({ itemType, status, limit = 25, offset = 0 }) {
  const result = await pool.query(
    `SELECT * FROM (${BOOKINGS_UNION}) all_bookings
     WHERE ($1::text IS NULL OR item_type = $1)
       AND ($2::text IS NULL OR status = $2)
     ORDER BY created_at DESC
     LIMIT $3 OFFSET $4`,
    [itemType || null, status || null, limit, offset]
  );
  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS count FROM (${BOOKINGS_UNION}) all_bookings
     WHERE ($1::text IS NULL OR item_type = $1)
       AND ($2::text IS NULL OR status = $2)`,
    [itemType || null, status || null]
  );
  return { rows: result.rows, total: countResult.rows[0].count };
}

async function getAllUsers({ search, limit = 25, offset = 0 }) {
  const result = await pool.query(
    `SELECT id, full_name, email, phone, role, wallet_balance, created_at
     FROM users
     WHERE ($1::text IS NULL OR full_name ILIKE '%' || $1 || '%' OR email ILIKE '%' || $1 || '%')
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [search || null, limit, offset]
  );
  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS count FROM users
     WHERE ($1::text IS NULL OR full_name ILIKE '%' || $1 || '%' OR email ILIKE '%' || $1 || '%')`,
    [search || null]
  );
  return { rows: result.rows, total: countResult.rows[0].count };
}

async function setUserRole(userId, role) {
  const result = await pool.query(
    `UPDATE users SET role = $1 WHERE id = $2 RETURNING id, full_name, email, role`,
    [role, userId]
  );
  return result.rows[0] || null;
}

async function getAllPayments({ status, limit = 25, offset = 0 }) {
  const result = await pool.query(
    `SELECT p.*, u.full_name AS user_name, u.email AS user_email
     FROM payments p
     LEFT JOIN bookings b ON b.id = p.booking_id
     LEFT JOIN users u ON u.id = b.user_id
     WHERE ($1::text IS NULL OR p.status = $1)
     ORDER BY p.created_at DESC
     LIMIT $2 OFFSET $3`,
    [status || null, limit, offset]
  );
  return result.rows;
}

async function getAllRefunds({ status, limit = 25, offset = 0 }) {
  const result = await pool.query(
    `SELECT * FROM refunds
     WHERE ($1::text IS NULL OR status = $1)
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [status || null, limit, offset]
  );
  return result.rows;
}

async function getAllCoupons() {
  const result = await pool.query(`SELECT * FROM coupons ORDER BY created_at DESC`);
  return result.rows;
}

async function createCoupon(data) {
  const { code, discountType, discountValue, minOrderAmount, maxUses, validFrom, validUntil } = data;
  const result = await pool.query(
    `INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, max_uses, uses_count, valid_from, valid_until, is_active)
     VALUES ($1, $2, $3, $4, $5, 0, $6, $7, true)
     RETURNING *`,
    [code.toUpperCase(), discountType, discountValue, minOrderAmount || 0, maxUses || null, validFrom || null, validUntil || null]
  );
  return result.rows[0];
}

async function setCouponActive(couponId, isActive) {
  const result = await pool.query(
    `UPDATE coupons SET is_active = $1 WHERE id = $2 RETURNING *`,
    [isActive, couponId]
  );
  return result.rows[0] || null;
}

async function getAllVisaApplications({ status, limit = 25, offset = 0 }) {
  const result = await pool.query(
    `SELECT v.*, u.full_name AS user_name, u.email AS user_email
     FROM visa_applications v
     JOIN users u ON u.id = v.user_id
     WHERE ($1::text IS NULL OR v.status = $1)
     ORDER BY v.created_at DESC
     LIMIT $2 OFFSET $3`,
    [status || null, limit, offset]
  );
  return result.rows;
}

async function updateVisaApplicationStatus(applicationId, status, notes) {
  const result = await pool.query(
    `UPDATE visa_applications SET status = $1, notes = COALESCE($2, notes) WHERE id = $3 RETURNING *`,
    [status, notes ?? null, applicationId]
  );
  return result.rows[0] || null;
}

module.exports = {
  getDashboardStats,
  getAllBookings,
  getAllUsers,
  setUserRole,
  getAllPayments,
  getAllRefunds,
  getAllCoupons,
  createCoupon,
  setCouponActive,
  getAllVisaApplications,
  updateVisaApplicationStatus,
};