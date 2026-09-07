const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/adminController');

router.use(protect, authorize('admin'));

router.get('/stats', ctrl.stats);

router.get('/bookings', ctrl.bookings);

router.get('/users', ctrl.users);
router.patch('/users/:id/role', ctrl.updateUserRole);

router.get('/payments', ctrl.payments);
router.get('/refunds', ctrl.refunds);
router.post('/refunds/retry', ctrl.retryRefunds);

router.get('/coupons', ctrl.coupons);
router.post('/coupons', ctrl.addCoupon);
router.patch('/coupons/:id', ctrl.toggleCoupon);

router.get('/visa-applications', ctrl.visaApplications);
router.patch('/visa-applications/:id', ctrl.updateVisaStatus);

module.exports = router;