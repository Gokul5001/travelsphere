exports.up = (pgm) => {
    pgm.createTable('refunds', {
      id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
      payment_id: { type: 'uuid', notNull: true, references: 'payments', onDelete: 'CASCADE' },
      booking_id: { type: 'uuid', notNull: true, references: 'bookings', onDelete: 'CASCADE' },
      razorpay_refund_id: { type: 'varchar(100)' },
      amount: { type: 'numeric(10,2)', notNull: true },
      status: { type: 'varchar(20)', notNull: true, default: 'initiated' },
      failure_reason: { type: 'text' },
      created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
      updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });
  
    pgm.addConstraint('refunds', 'refunds_status_check', {
      check: "status IN ('initiated', 'processed', 'failed')",
    });
  
    pgm.createIndex('refunds', 'booking_id');
    pgm.createIndex('refunds', 'payment_id');
  };
  
  exports.down = (pgm) => {
    pgm.dropTable('refunds');
  };