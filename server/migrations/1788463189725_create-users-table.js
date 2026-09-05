exports.up = (pgm) => {
    pgm.createExtension('pgcrypto', { ifNotExists: true }); // enables gen_random_uuid()
  
    pgm.createTable('users', {
      id: {
        type: 'uuid',
        primaryKey: true,
        default: pgm.func('gen_random_uuid()'),
      },
      full_name: { type: 'varchar(150)', notNull: true },
      email: { type: 'varchar(255)', notNull: true, unique: true },
      password_hash: { type: 'text', notNull: true },
      phone: { type: 'varchar(20)' },
      role: {
        type: 'varchar(20)',
        notNull: true,
        default: 'customer',
      },
      is_active: { type: 'boolean', notNull: true, default: true },
      created_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('now()'),
      },
      updated_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('now()'),
      },
    });
  
    // enforce role can only be one of these values
    pgm.addConstraint('users', 'users_role_check', {
      check: "role IN ('customer', 'admin', 'support')",
    });
  
    // index for fast login lookups by email
    pgm.createIndex('users', 'email');
  };
  
  exports.down = (pgm) => {
    pgm.dropTable('users');
  };