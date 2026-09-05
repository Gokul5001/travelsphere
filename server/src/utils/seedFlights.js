require('dotenv').config();

const pool = require('../config/db');

const flights = [
  ['6E202', 'IndiGo', 'Chennai', 'Delhi', '2026-09-10 06:00:00+05:30', '2026-09-10 08:45:00+05:30', 4500, 150],
  ['AI440', 'Air India', 'Chennai', 'Mumbai', '2026-09-10 09:30:00+05:30', '2026-09-10 11:30:00+05:30', 5200, 180],
  ['SG112', 'SpiceJet', 'Chennai', 'Bangalore', '2026-09-10 14:00:00+05:30', '2026-09-10 15:00:00+05:30', 2100, 2],
];

async function seed() {
  for (const f of flights) {
    await pool.query(
      `INSERT INTO flights
       (flight_number, airline, origin, destination, departure_time, arrival_time, base_price, total_seats, available_seats)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)`,
      f
    );
  }
  console.log('Flights seeded');
  process.exit(0);
}

seed();