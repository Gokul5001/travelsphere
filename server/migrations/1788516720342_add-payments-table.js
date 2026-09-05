exports.up = (pgm) => {
    pgm.createTable('payments', {
      id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
      booking_id: {
        type: 'uuid',
        notNull: true,
        references: 'bookings',
        onDelete: 'CASCADE',
      },
      razorpay_order_id: { type: 'varchar(100)', notNull: true, unique: true },
      razorpay_payment_id: { type: 'varchar(100)' },
      amount: { type: 'numeric(10,2)', notNull: true },
      status: { type: 'varchar(20)', notNull: true, default: 'created' },
      created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
      updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });
  
    pgm.addConstraint('payments', 'payments_status_check', {
      check: "status IN ('created', 'paid', 'failed', 'refunded')",
    });
  
    pgm.createIndex('payments', 'booking_id');
    pgm.createIndex('payments', 'razorpay_order_id');
  };
  
  exports.down = (pgm) => {
    pgm.dropTable('payments');
  };