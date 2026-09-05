const {
  searchHotels,
  cancelHotelBooking,
  createHotelBookingWithWallet,
  getHotelBookingsByUserId,
} = require('../models/hotelModel');
const { processHotelRefund } = require('./hotelPaymentController');
  
  async function search(req, res) {
    try {
      const { city } = req.query;
      const results = await searchHotels({ city });
      res.json({ results });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Hotel search failed' });
    }
  }
  
  async function cancel(req, res) {
    try {
      const { id } = req.params;
      const result = await cancelHotelBooking({ bookingId: id, userId: req.user.id });
  
      if (result.error === 'NOT_FOUND') return res.status(404).json({ error: 'Booking not found' });
      if (result.error === 'FORBIDDEN') return res.status(403).json({ error: 'Not your booking' });
      if (result.error === 'INVALID_STATUS') {
        return res.status(409).json({ error: `Booking cannot be cancelled (current status: ${result.currentStatus})` });
      }
      if (result.error === 'TOO_LATE') {
        return res.status(409).json({ error: 'Cancellation window has passed — must cancel at least 24 hours before check-in' });
      }
  
      let refund = null;
      if (result.needsRefund) {
        refund = await processHotelRefund(id, result.booking.user_id);
      }
  
      res.json({ booking: result.booking, refund });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Cancellation failed' });
    }
  }
  
  async function bookWithWallet(req, res) {
    try {
      const { hotelId, checkIn, checkOut, rooms } = req.body;
  
      if (!hotelId || !checkIn || !checkOut || !rooms || rooms < 1) {
        return res.status(400).json({ error: 'hotelId, checkIn, checkOut and a valid room count are required' });
      }
  
      const result = await createHotelBookingWithWallet({
        userId: req.user.id,
        hotelId,
        checkIn,
        checkOut,
        roomsRequested: rooms,
      });
  
      if (result.error === 'HOTEL_NOT_FOUND') return res.status(404).json({ error: 'Hotel not found' });
      if (result.error === 'NOT_ENOUGH_ROOMS') {
        return res.status(409).json({ error: 'Not enough rooms available', available: result.available });
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

  async function myBookings(req, res) {
    try {
      const bookings = await getHotelBookingsByUserId(req.user.id);
      res.json({ bookings });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Could not load your hotel bookings' });
    }
  }
  
  
  module.exports = { search, cancel, bookWithWallet, myBookings };