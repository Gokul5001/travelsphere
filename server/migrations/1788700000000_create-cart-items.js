/* eslint-disable camelcase */

exports.up = (pgm) => {
  pgm.createTable('cart_items', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    // 'flight' | 'hotel' | 'bus' | 'package'
    item_type: {
      type: 'varchar(20)',
      notNull: true,
    },
    // id of the row in flights / hotels / buses / packages
    item_id: {
      type: 'uuid',
      notNull: true,
    },
    // seats for flight/bus, rooms for hotel, quantity for package
    quantity: {
      type: 'integer',
      notNull: true,
      default: 1,
    },
    // type-specific extras: { checkIn, checkOut } for hotels, { couponCode } for any type
    details: {
      type: 'jsonb',
      notNull: true,
      default: pgm.func("'{}'::jsonb"),
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.addConstraint('cart_items', 'cart_items_item_type_check', {
    check: "item_type IN ('flight','hotel','bus','package')",
  });

  pgm.createIndex('cart_items', 'user_id');
};

exports.down = (pgm) => {
  pgm.dropTable('cart_items');
};
