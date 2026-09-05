const { getWalletSummary, createTopupRecord } = require('../models/walletModel');
const razorpay = require('../config/razorpay'); // see note below

async function getWallet(req, res) {
  try {
    const summary = await getWalletSummary(req.user.id);
    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch wallet' });
  }
}

async function initiateTopup(req, res) {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'A valid top-up amount is required' });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `topup_${req.user.id}_${Date.now()}`,
    });

    await createTopupRecord({ userId: req.user.id, razorpayOrderId: order.id, amount });

    res.status(201).json({
      razorpayOrder: order,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Top-up initiation failed' });
  }
}

module.exports = { getWallet, initiateTopup };