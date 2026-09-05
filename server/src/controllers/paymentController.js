const Razorpay = require('razorpay');
const crypto = require('crypto');
const { getFlightById } = require('../models/flightModel');
const { createFlightBooking } = require('../models/bookingModel');
const { createPaymentRecord, markPaymentPaid, findPaidPaymentByBookingId } = require('../models/paymentModel');
const { createRefundRecord, markRefundProcessed, markRefundFailed, markRefundInitiated, getFailedRefunds } = require('../models/refundModel');
const razorpay = require('../config/razorpay');
const { creditWalletFromTopup } = require('../models/walletModel');
const { creditWalletRefund } = require('../models/walletModel');
const { markHotelPaymentPaid } = require('./hotelPaymentController');
const { markBusPaymentPaid } = require('./busPaymentController');
const { markPackagePaymentPaid } = require('./packagePaymentController');


// const razorpay = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID,
//   key_secret: process.env.RAZORPAY_KEY_SECRET,
// });

// STEP 1: create booking (pending) + Razorpay order
async function initiateCheckout(req, res) {
  try {
    const { flightId, seats, couponCode } = req.body;   // add couponCode here

    if (!flightId || !seats || seats < 1) {
      return res.status(400).json({ error: 'flightId and a valid seat count are required' });
    }

    const bookingResult = await createFlightBooking({
      userId: req.user.id,
      flightId,
      seatsRequested: seats,
      couponCode,                                        // and pass it through here
    });

    if (bookingResult.error === 'FLIGHT_NOT_FOUND') {
      return res.status(404).json({ error: 'Flight not found' });
    }
    if (bookingResult.error === 'NOT_ENOUGH_SEATS') {
      return res.status(409).json({ error: 'Not enough seats available' });
    }
    // handle the coupon errors your model can now return:
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
      return res.status(400).json({
        error: `This coupon requires a minimum order of ₹${bookingResult.minOrderAmount}`,
      });
    }
    if (bookingResult.error === 'COUPON_LIMIT_REACHED') {
      return res.status(400).json({ error: 'This coupon has reached its usage limit' });
    }

    const booking = bookingResult.booking;

    // Razorpay expects amount in paise (smallest currency unit)
    const order = await razorpay.orders.create({
      amount: Math.round(booking.total_price * 100),
      currency: 'INR',
      receipt: booking.id,
    });

    await createPaymentRecord({
      bookingId: booking.id,
      razorpayOrderId: order.id,
      amount: booking.total_price,
    });

    res.status(201).json({
      booking,
      razorpayOrder: order,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID, // frontend needs this to open checkout
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Checkout initiation failed' });
  }
}

// STEP 2: Razorpay calls this automatically after payment
async function handleWebhook(req, res) {
    try {
      const signature = req.headers['x-razorpay-signature'];
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(req.body)
        .digest('hex');
  
      const isValid =
        signature &&
        expectedSignature.length === signature.length &&
        crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
  
      if (!isValid) {
        return res.status(400).json({ error: 'Invalid webhook signature' });
      }
  
      const event = JSON.parse(req.body).event;
  
      if (event === 'payment.captured') {
        const payment = JSON.parse(req.body).payload.payment.entity;
    
        const result = await markPaymentPaid(payment.order_id, payment.id);

        if (result.error === 'PAYMENT_NOT_FOUND') {
          const hotelResult = await markHotelPaymentPaid(payment.order_id, payment.id);
        
          if (hotelResult.error === 'PAYMENT_NOT_FOUND') {
            const busResult = await markBusPaymentPaid(payment.order_id, payment.id);
        
            if (busResult.error === 'PAYMENT_NOT_FOUND') {
              const packageResult = await markPackagePaymentPaid(payment.order_id, payment.id);
        
              if (packageResult.error === 'PAYMENT_NOT_FOUND') {
                const topupResult = await creditWalletFromTopup(payment.order_id, payment.id);
                if (topupResult.error) {
                  console.error(`Webhook order ${payment.order_id} matched no flight, hotel, bus, package payment, or top-up`);
                } else if (topupResult.alreadyProcessed) {
                  console.log(`Top-up for order ${payment.order_id} already processed — skipping`);
                }
              } else if (packageResult.alreadyProcessed) {
                console.log(`Package webhook for order ${payment.order_id} already processed — skipping`);
              }
            } else if (busResult.alreadyProcessed) {
              console.log(`Bus webhook for order ${payment.order_id} already processed — skipping`);
            }
          } else if (hotelResult.alreadyProcessed) {
            console.log(`Hotel webhook for order ${payment.order_id} already processed — skipping`);
          }
        } else if (result.alreadyProcessed) {
          console.log(`Webhook for order ${payment.order_id} already processed — skipping`);
        }
      }

      
  
      res.status(200).json({ received: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }


  async function processRefund(bookingId, userId) {
    const payment = await findPaidPaymentByBookingId(bookingId);
    if (!payment) return null; // nothing was ever paid — nothing to refund
  
    if (payment.payment_method === 'wallet') {
      try {
        await creditWalletRefund({ userId, bookingId, amount: payment.amount });
        return await createRefundRecord({
          paymentId: payment.id,
          bookingId,
          amount: payment.amount,
          status: 'processed', // wallet credit is synchronous — no webhook confirmation needed
        });
      } catch (err) {
        console.error(`Wallet refund failed for booking ${bookingId}:`, err.message);
        return await createRefundRecord({
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
  
      return await createRefundRecord({
        paymentId: payment.id,
        bookingId,
        razorpayRefundId: razorpayRefund.id,
        amount: payment.amount,
        status: 'initiated',
      });
    } catch (err) {
      console.error(`Refund initiation failed for booking ${bookingId}:`, err.message);
      return await createRefundRecord({
        paymentId: payment.id,
        bookingId,
        amount: payment.amount,
        status: 'failed',
        failureReason: err.message,
      });
    }
  }
  
  // retried by the cron job below
  async function retryFailedRefunds() {
    const failed = await getFailedRefunds();
    let retried = 0;
  
    for (const refund of failed) {
      try {
        const razorpayRefund = await razorpay.payments.refund(
          undefined, // see note below
          { amount: Math.round(refund.amount * 100) }
        );
        await markRefundInitiated(refund.id, razorpayRefund.id);
        retried++;
      } catch (err) {
        console.error(`Refund retry still failing for refund ${refund.id}:`, err.message);
        await markRefundFailed(refund.id, err.message);
      }
    }
    return { scanned: failed.length, retried };
  }
  
  module.exports = { initiateCheckout, handleWebhook, processRefund, retryFailedRefunds };