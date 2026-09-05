const {
    searchPackages,
    cancelPackageBooking,
    createPackageBookingWithWallet,
    getPackageBookingsByUserId,
  } = require('../models/packageModel');
  const { processPackageRefund } = require('./packagePaymentController');
  
  async function search(req, res) {
    try {
      const { destination } = req.query;
      const results = await searchPackages({ destination });
      res.json({ results });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Package search failed' });
    }
  }
  
  async function myBookings(req, res) {
    try {
      const bookings = await getPackageBookingsByUserId(req.user.id);
      res.json({ bookings });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Could not load your package bookings' });
    }
  }
  
  async function cancel(req, res) {
    try {
      const { id } = req.params;
      const result = await cancelPackageBooking({ bookingId: id, userId: req.user.id });
  
      if (result.error === 'NOT_FOUND') return res.status(404).json({ error: 'Booking not found' });
      if (result.error === 'FORBIDDEN') return res.status(403).json({ error: 'Not your booking' });
      if (result.error === 'INVALID_STATUS') {
        return res.status(409).json({ error: `Booking cannot be cancelled (current status: ${result.currentStatus})` });
      }
      if (result.error === 'TOO_LATE') {
        return res.status(409).json({ error: 'Cancellation window has passed — must cancel at least 48 hours before departure' });
      }
  
      let refund = null;
      if (result.needsRefund) {
        refund = await processPackageRefund(id, result.booking.user_id);
      }
  
      res.json({ booking: result.booking, refund });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Cancellation failed' });
    }
  }
  
  async function bookWithWallet(req, res) {
    try {
      const { packageId, persons } = req.body;
  
      if (!packageId || !persons || persons < 1) {
        return res.status(400).json({ error: 'packageId and a valid person count are required' });
      }
  
      const result = await createPackageBookingWithWallet({
        userId: req.user.id,
        packageId,
        personsRequested: persons,
      });
  
      if (result.error === 'PACKAGE_NOT_FOUND') return res.status(404).json({ error: 'Package not found' });
      if (result.error === 'NOT_ENOUGH_SLOTS') {
        return res.status(409).json({ error: 'Not enough slots available', available: result.available });
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