//flightController.js

const { searchFlights, getFlightById } = require('../models/flightModel');
const { createFlightBooking, getBookingsByUserId } = require('../models/bookingModel');


async function search(req, res) {
  try {
    const { origin, destination, date, page, limit } = req.query;
    const flights = await searchFlights({ origin, destination, date, page: Number(page) || 1, limit: Number(limit) || 10 });
    res.json({ results: flights, count: flights.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Search failed' });
  }
}

async function bookFlight(req, res) {
  try {
    const { flightId, seats } = req.body;

    if (!flightId || !seats || seats < 1) {
      return res.status(400).json({ error: 'flightId and a valid seat count are required' });
    }

    const result = await createFlightBooking({
      userId: req.user.id,
      flightId,
      seatsRequested: seats,
    });

    if (result.error === 'FLIGHT_NOT_FOUND') {
      return res.status(404).json({ error: 'Flight not found' });
    }
    if (result.error === 'NOT_ENOUGH_SEATS') {
      return res.status(409).json({ error: 'Not enough seats available', available: result.available });
    }

    res.status(201).json({ booking: result.booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Booking failed' });
  }
}


async function myBookings(req, res) {
  try {
    const bookings = await getBookingsByUserId(req.user.id);
    res.json({ bookings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
}


module.exports = { search, bookFlight, myBookings  };