const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error('DB connection failed:', err.message);
  else console.log('DB connected at:', res.rows[0].now);
});

module.exports = pool;