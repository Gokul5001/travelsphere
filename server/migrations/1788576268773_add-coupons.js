exports.up = (pgm) => {
    pgm.createTable('coupons', {
      id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
      code: { type: 'varchar(30)', notNull: true, unique: true },
      discount_type: { type: 'varchar(10)', notNull: true }, // percent | flat
      discount_value: { type: 'numeric(10,2)', notNull: true },
      max_uses: { type: 'integer' }, // NULL = unlimited
      uses_count: { type: 'integer', notNull: true, default: 0 },
      min_order_amount: { type: 'numeric(10,2)', notNull: true, default: 0 },
      valid_from: { type: 'timestamptz' },
      valid_until: { type: 'timestamptz' },
      is_active: { type: 'boolean', notNull: true, default: true },
      created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });
  
    pgm.addConstraint('coupons', 'coupons_discount_type_check', {
      check: "discount_type IN ('percent', 'flat')",
    });
  
    pgm.addColumn('bookings', {
      coupon_code: { type: 'varchar(30)' },
    });
  };
  
  exports.down = (pgm) => {
    pgm.dropColumn('bookings', 'coupon_code');
    pgm.dropTable('coupons');
  };