exports.up = (pgm) => {
    pgm.createTable('bookings', {
      id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
      user_id: {
        type: 'uuid',
        notNull: true,
        references: 'users',
        onDelete: 'CASCADE',
      },
      flight_id: {
        type: 'uuid',
        notNull: true,
        references: 'flights',
        onDelete: 'RESTRICT',
      },
      seats_booked: { type: 'integer', notNull: true },
      total_price: { type: 'numeric(10,2)', notNull: true },
      status: { type: 'varchar(20)', notNull: true, default: 'confirmed' },
      created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });
  
    pgm.addConstraint('bookings', 'bookings_status_check', {
      check: "status IN ('pending', 'confirmed', 'cancelled', 'failed')",
    });
  
    pgm.addConstraint('bookings', 'bookings_seats_check', {
      check: 'seats_booked > 0',
    });
  
    pgm.createIndex('bookings', 'user_id');
    pgm.createIndex('bookings', 'flight_id');
  };
  
  exports.down = (pgm) => {
    pgm.dropTable('bookings');
  };