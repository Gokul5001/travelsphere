const {
    searchBuses,
    cancelBusBooking,
    createBusBookingWithWallet,
    getBusBookingsByUserId,
  } = require('../models/busModel');
  const { processBusRefund } = require('./busPaymentController');
  
  async function search(req, res) {
    try {
      const { origin, destination, date } = req.query;
      const results = await searchBuses({ origin, destination, date });
      res.json({ results });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Bus search failed' });
    }
  }
  
  async function myBookings(req, res) {
    try {
      const bookings = await getBusBookingsByUserId(req.user.id);
      res.json({ bookings });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Could not load your bus bookings' });
    }
  }
  
  async function cancel(req, res) {
    try {
      const { id } = req.params;
      const result = await cancelBusBooking({ bookingId: id, userId: req.user.id });
  
      if (result.error === 'NOT_FOUND') return res.status(404).json({ error: 'Booking not found' });
      if (result.error === 'FORBIDDEN') return res.status(403).json({ error: 'Not your booking' });
      if (result.error === 'INVALID_STATUS') {
        return res.status(409).json({ error: `Booking cannot be cancelled (current status: ${result.currentStatus})` });
      }
      if (result.error === 'TOO_LATE') {
        return res.status(409).json({ error: 'Cancellation window has passed — must cancel at least 2 hours before departure' });
      }
  
      let refund = null;
      if (result.needsRefund) {
        refund = await processBusRefund(id, result.booking.user_id);
      }
  
      res.json({ booking: result.booking, refund });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Cancellation failed' });
    }
  }
  
  async function bookWithWallet(req, res) {
    try {
      const { busId, seats } = req.body;
  
      if (!busId || !seats || seats < 1) {
        return res.status(400).json({ error: 'busId and a valid seat count are required' });
      }
  
      const result = await createBusBookingWithWallet({
        userId: req.user.id,
        busId,
        seatsRequested: seats,
      });
  
      if (result.error === 'BUS_NOT_FOUND') return res.status(404).json({ error: 'Bus not found' });
      if (result.error === 'NOT_ENOUGH_SEATS') {
        return res.status(409).json({ error: 'Not enough seats available', available: result.available });
      }
      if (result.error === 'INSUFFICIENT_BALANCE') {
        return res.status(402).json({
          error: 'Insufficient wallet balance',
          balance: result.balance,
          required: result.required,
        });
      }
  
      res.status(201).json({ booking: result.booking, newBalance: result.newBalance });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Wallet booking failed' });
    }
  }
  
  module.exports = { search, cancel, bookWithWallet, myBookings };