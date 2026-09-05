exports.up = (pgm) => {
    pgm.createTable('flights', {
      id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
      flight_number: { type: 'varchar(20)', notNull: true },
      airline: { type: 'varchar(100)', notNull: true },
      origin: { type: 'varchar(100)', notNull: true },
      destination: { type: 'varchar(100)', notNull: true },
      departure_time: { type: 'timestamptz', notNull: true },
      arrival_time: { type: 'timestamptz', notNull: true },
      base_price: { type: 'numeric(10,2)', notNull: true },
      total_seats: { type: 'integer', notNull: true },
      available_seats: { type: 'integer', notNull: true },
      created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });
  
    pgm.addConstraint('flights', 'flights_seats_check', {
      check: 'available_seats >= 0 AND available_seats <= total_seats',
    });
  
    // indexes for the search patterns we'll actually query by
    pgm.createIndex('flights', ['origin', 'destination', 'departure_time']);
  };
  
  exports.down = (pgm) => {
    pgm.dropTable('flights');
  };