const pool = require('../config/db');

async function searchFlights({ origin, destination, date, page = 1, limit = 10 }) {
  const offset = (page - 1) * limit;
  const values = [];
  let where = 'WHERE 1=1';

  if (origin) {
    values.push(origin);
    where += ` AND origin ILIKE $${values.length}`;
  }
  if (destination) {
    values.push(destination);
    where += ` AND destination ILIKE $${values.length}`;
  }
  if (date) {
    values.push(date);
    where += ` AND DATE(departure_time) = $${values.length}`;
  }

  values.push(limit, offset);

  const result = await pool.query(
    `SELECT * FROM flights ${where}
     ORDER BY departure_time ASC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  return result.rows;
}

async function getFlightById(id) {
  const result = await pool.query('SELECT * FROM flights WHERE id = $1', [id]);
  return result.rows[0];
}

module.exports = { searchFlights, getFlightById };