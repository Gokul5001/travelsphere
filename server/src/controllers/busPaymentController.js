const razorpay = require('../config/razorpay');
const { createBusBooking } = require('../models/busModel');
const {
  createBusPaymentRecord,
  markBusPaymentPaid,
  findPaidBusPaymentByBookingId,
} = require('../models/busPaymentModel');
const { createBusRefundRecord } = require('../models/busRefundModel');
const { creditWalletRefund } = require('../models/walletModel');

async function initiateBusCheckout(req, res) {
  try {
    const { busId, seats, couponCode } = req.body;

    if (!busId || !seats || seats < 1) {
      return res.status(400).json({ error: 'busId and a valid seat count are required' });
    }

    const bookingResult = await createBusBooking({
      userId: req.user.id,
      busId,
      seatsRequested: seats,
      couponCode,
    });

    if (bookingResult.error === 'BUS_NOT_FOUND') return res.status(404).json({ error: 'Bus not found' });
    if (bookingResult.error === 'NOT_ENOUGH_SEATS') {
      return res.status(409).json({ error: 'Not enough seats available' });
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

    await createBusPaymentRecord({
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
    res.status(500).json({ error: 'Bus checkout initiation failed' });
  }
}

async function processBusRefund(bookingId, userId) {
  const payment = await findPaidBusPaymentByBookingId(bookingId);
  if (!payment) return null;

  if (payment.payment_method === 'wallet') {
    try {
      await creditWalletRefund({ userId, bookingId, amount: payment.amount });
      return await createBusRefundRecord({
        paymentId: payment.id,
        bookingId,
        amount: payment.amount,
        status: 'processed',
      });
    } catch (err) {
      console.error(`Wallet refund failed for bus booking ${bookingId}:`, err.message);
      return await createBusRefundRecord({
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
    return await createBusRefundRecord({
      paymentId: payment.id,
      bookingId,
      razorpayRefundId: razorpayRefund.id,
      amount: payment.amount,
      status: 'initiated',
    });
  } catch (err) {
    console.error(`Bus refund initiation failed for booking ${bookingId}:`, err.message);
    return await createBusRefundRecord({
      paymentId: payment.id,
      bookingId,
      amount: payment.amount,
      status: 'failed',
      failureReason: err.message,
    });
  }
}

module.exports = { initiateBusCheckout, processBusRefund, markBusPaymentPaid };