const razorpay = require('../config/razorpay');
const { createPackageBooking } = require('../models/packageModel');
const {
  createPackagePaymentRecord,
  markPackagePaymentPaid,
  findPaidPackagePaymentByBookingId,
} = require('../models/packagePaymentModel');
const { createPackageRefundRecord } = require('../models/packageRefundModel');
const { creditWalletRefund } = require('../models/walletModel');

async function initiatePackageCheckout(req, res) {
  try {
    const { packageId, persons, couponCode } = req.body;

    if (!packageId || !persons || persons < 1) {
      return res.status(400).json({ error: 'packageId and a valid person count are required' });
    }

    const bookingResult = await createPackageBooking({
      userId: req.user.id,
      packageId,
      personsRequested: persons,
      couponCode,
    });

    if (bookingResult.error === 'PACKAGE_NOT_FOUND') return res.status(404).json({ error: 'Package not found' });
    if (bookingResult.error === 'NOT_ENOUGH_SLOTS') {
      return res.status(409).json({ error: 'Not enough slots available' });
    }
    if (bookingResult.error === 'COUPON_INVALID') {
      return res.status(400).json({ error: 'Invalid or inactive coupon code' });
    }
    if (bookingResult.error === 'COUPON_NOT_YET_VALID') {
      return res.status(400).json({ error: 'This coupon is not active yet' });
    }
    if (bookingResult.error === 'COUPON_EXPIRED') {
      return res.status(400).json({ error: 'This coupon has expired' });
    }
    if (bookingResult.error === 'COUPON_MIN_ORDER_NOT_MET') {
      return res.status(400).json({ error: `This coupon requires a minimum order of ₹${bookingResult.minOrderAmount}` });
    }
    if (bookingResult.error === 'COUPON_LIMIT_REACHED') {
      return res.status(400).json({ error: 'This coupon has reached its usage limit' });
    }

    const booking = bookingResult.booking;

    const order = await razorpay.orders.create({
      amount: Math.round(booking.total_price * 100),
      currency: 'INR',
      receipt: booking.id,
    });

    await createPackagePaymentRecord({
      bookingId: booking.id,
      razorpayOrderId: order.id,
      amount: booking.total_price,
    });

    res.status(201).json({
      booking,
      razorpayOrder: order,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Package checkout initiation failed' });
  }
}

async function processPackageRefund(bookingId, userId) {
  const payment = await findPaidPackagePaymentByBookingId(bookingId);
  if (!payment) return null;

  if (payment.payment_method === 'wallet') {
    try {
      await creditWalletRefund({ userId, bookingId, amount: payment.amount });
      return await createPackageRefundRecord({
        paymentId: payment.id,
        bookingId,
        amount: payment.amount,
        status: 'processed',
      });
    } catch (err) {
      console.error(`Wallet refund failed for package booking ${bookingId}:`, err.message);
      return await createPackageRefundRecord({
        paymentId: payment.id,
        bookingId,
        amount: payment.amount,
        status: 'failed',
        failureReason: err.message,
      });
    }
  }

  try {
    const razorpayRefund = await razorpay.payments.refund(payment.razorpay_payment_id, {
      amount: Math.round(payment.amount * 100),
    });
    return await createPackageRefundRecord({
      paymentId: payment.id,
      bookingId,
      razorpayRefundId: razorpayRefund.id,
      amount: payment.amount,
      status: 'initiated',
    });
  } catch (err) {
    console.error(`Package refund initiation failed for booking ${bookingId}:`, err.message);
    return await createPackageRefundRecord({
      paymentId: payment.id,
      bookingId,
      amount: payment.amount,
      status: 'failed',
      failureReason: err.message,
    });
  }
}

module.exports = { initiatePackageCheckout, processPackageRefund, markPackagePaymentPaid };