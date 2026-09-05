const razorpay = require('../config/razorpay');
const { createHotelBooking } = require('../models/hotelModel');
const {
  createHotelPaymentRecord,
  markHotelPaymentPaid,
  findPaidHotelPaymentByBookingId,
} = require('../models/hotelPaymentModel');
const { createHotelRefundRecord } = require('../models/hotelRefundModel');
const { creditWalletRefund } = require('../models/walletModel');

async function initiateHotelCheckout(req, res) {
  try {
    const { hotelId, checkIn, checkOut, rooms, couponCode } = req.body;

    if (!hotelId || !checkIn || !checkOut || !rooms || rooms < 1) {
      return res.status(400).json({ error: 'hotelId, checkIn, checkOut and a valid room count are required' });
    }

    const bookingResult = await createHotelBooking({
      userId: req.user.id,
      hotelId,
      checkIn,
      checkOut,
      roomsRequested: rooms,
      couponCode,
    });

    if (bookingResult.error === 'HOTEL_NOT_FOUND') return res.status(404).json({ error: 'Hotel not found' });
    if (bookingResult.error === 'NOT_ENOUGH_ROOMS') {
      return res.status(409).json({ error: 'Not enough rooms available' });
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

    await createHotelPaymentRecord({
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
    res.status(500).json({ error: 'Hotel checkout initiation failed' });
  }
}

async function processHotelRefund(bookingId, userId) {
  const payment = await findPaidHotelPaymentByBookingId(bookingId);
  if (!payment) return null;

  if (payment.payment_method === 'wallet') {
    try {
      await creditWalletRefund({ userId, bookingId, amount: payment.amount });
      return await createHotelRefundRecord({
        paymentId: payment.id,
        bookingId,
        amount: payment.amount,
        status: 'processed',
      });
    } catch (err) {
      console.error(`Wallet refund failed for hotel booking ${bookingId}:`, err.message);
      return await createHotelRefundRecord({
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
    return await createHotelRefundRecord({
      paymentId: payment.id,
      bookingId,
      razorpayRefundId: razorpayRefund.id,
      amount: payment.amount,
      status: 'initiated',
    });
  } catch (err) {
    console.error(`Hotel refund initiation failed for booking ${bookingId}:`, err.message);
    return await createHotelRefundRecord({
      paymentId: payment.id,
      bookingId,
      amount: payment.amount,
      status: 'failed',
      failureReason: err.message,
    });
  }
}

module.exports = { initiateHotelCheckout, processHotelRefund, markHotelPaymentPaid };