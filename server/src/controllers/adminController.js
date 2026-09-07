const {
    getDashboardStats, getAllBookings, getAllUsers, setUserRole,
    getAllPayments, getAllRefunds, getAllCoupons, createCoupon, setCouponActive,
    getAllVisaApplications, updateVisaApplicationStatus,
  } = require('../models/adminModel');
  const { retryFailedRefunds } = require('./paymentController');
  
  function pagination(req) {
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    const offset = Number(req.query.offset) || 0;
    return { limit, offset };
  }
  
  async function stats(req, res) {
    try {
      res.json(await getDashboardStats());
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Could not load dashboard stats' });
    }
  }
  
  async function bookings(req, res) {
    try {
      const { itemType, status } = req.query;
      const { limit, offset } = pagination(req);
      const result = await getAllBookings({ itemType, status, limit, offset });
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Could not load bookings' });
    }
  }
  
  async function users(req, res) {
    try {
      const { search } = req.query;
      const { limit, offset } = pagination(req);
      const result = await getAllUsers({ search, limit, offset });
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Could not load users' });
    }
  }
  
  async function updateUserRole(req, res) {
    try {
      const { role } = req.body;
      if (!['user', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      if (req.params.id === String(req.user.id)) {
        return res.status(400).json({ error: "You can't change your own role" });
      }
      const updated = await setUserRole(req.params.id, role);
      if (!updated) return res.status(404).json({ error: 'User not found' });
      res.json({ user: updated });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Could not update role' });
    }
  }
  
  async function payments(req, res) {
    try {
      const { status } = req.query;
      const { limit, offset } = pagination(req);
      res.json({ payments: await getAllPayments({ status, limit, offset }) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Could not load payments' });
    }
  }
  
  async function refunds(req, res) {
    try {
      const { status } = req.query;
      const { limit, offset } = pagination(req);
      res.json({ refunds: await getAllRefunds({ status, limit, offset }) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Could not load refunds' });
    }
  }
  
  async function retryRefunds(req, res) {
    try {
      res.json(await retryFailedRefunds());
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Retry sweep failed' });
    }
  }
  
  async function coupons(req, res) {
    try {
      res.json({ coupons: await getAllCoupons() });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Could not load coupons' });
    }
  }
  
  async function addCoupon(req, res) {
    try {
      const coupon = await createCoupon(req.body);
      res.status(201).json({ coupon });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Could not create coupon' });
    }
  }
  
  async function toggleCoupon(req, res) {
    try {
      const updated = await setCouponActive(req.params.id, req.body.isActive);
      if (!updated) return res.status(404).json({ error: 'Coupon not found' });
      res.json({ coupon: updated });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Could not update coupon' });
    }
  }
  
  async function visaApplications(req, res) {
    try {
      const { status } = req.query;
      const { limit, offset } = pagination(req);
      res.json({ applications: await getAllVisaApplications({ status, limit, offset }) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Could not load visa applications' });
    }
  }
  
  async function updateVisaStatus(req, res) {
    try {
      const { status, notes } = req.body;
      const updated = await updateVisaApplicationStatus(req.params.id, status, notes);
      if (!updated) return res.status(404).json({ error: 'Application not found' });
      res.json({ application: updated });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Could not update application' });
    }
  }
  
  module.exports = {
    stats, bookings, users, updateUserRole, payments, refunds, retryRefunds,
    coupons, addCoupon, toggleCoupon, visaApplications, updateVisaStatus,
  };