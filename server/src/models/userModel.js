const pool = require('../config/db');

async function createUser({ fullName, email, passwordHash, phone }) {
  const result = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, phone)
     VALUES ($1, $2, $3, $4)
     RETURNING id, full_name, email, phone, role, created_at`,
    [fullName, email, passwordHash, phone]
  );
  return result.rows[0];
}

async function findUserByEmail(email) {
  const result = await pool.query(
    `SELECT * FROM users WHERE email = $1`,
    [email]
  );
  return result.rows[0];
}

async function findUserById(id) {
  const result = await pool.query(
    `SELECT id, full_name, email, phone, role, created_at FROM users WHERE id = $1`,
    [id]
  );
  return result.rows[0];
}

module.exports = { createUser, findUserByEmail, findUserById };