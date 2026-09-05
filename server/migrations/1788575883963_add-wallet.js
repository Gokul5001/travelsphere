exports.up = (pgm) => {
    pgm.addColumn('users', {
      wallet_balance: { type: 'numeric(10,2)', notNull: true, default: 0 },
    });
  
    pgm.createTable('wallet_transactions', {
      id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
      user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
      type: { type: 'varchar(10)', notNull: true }, // credit | debit
      amount: { type: 'numeric(10,2)', notNull: true },
      balance_after: { type: 'numeric(10,2)', notNull: true },
      reason: { type: 'varchar(50)', notNull: true }, // topup | booking_payment | refund_credit
      reference_id: { type: 'uuid' }, // booking id, topup id, refund id — no FK, since it points to different tables
      created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });
  
    pgm.addConstraint('wallet_transactions', 'wallet_transactions_type_check', {
      check: "type IN ('credit', 'debit')",
    });
    pgm.createIndex('wallet_transactions', 'user_id');
  
    pgm.createTable('wallet_topups', {
      id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
      user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
      razorpay_order_id: { type: 'varchar(100)', notNull: true, unique: true },
      razorpay_payment_id: { type: 'varchar(100)' },
      amount: { type: 'numeric(10,2)', notNull: true },
      status: { type: 'varchar(20)', notNull: true, default: 'created' },
      created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
      updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });
    pgm.addConstraint('wallet_topups', 'wallet_topups_status_check', {
      check: "status IN ('created', 'paid', 'failed')",
    });
  
    // payments.razorpay_order_id was NOT NULL — wallet-paid bookings have no Razorpay order at all
    pgm.alterColumn('payments', 'razorpay_order_id', { notNull: false });
    pgm.addColumn('payments', {
      payment_method: { type: 'varchar(20)', notNull: true, default: 'razorpay' },
    });
  };
  
  exports.down = (pgm) => {
    pgm.dropColumn('payments', 'payment_method');
    pgm.alterColumn('payments', 'razorpay_order_id', { notNull: true });
    pgm.dropTable('wallet_topups');
    pgm.dropTable('wallet_transactions');
    pgm.dropColumn('users', 'wallet_balance');
  };