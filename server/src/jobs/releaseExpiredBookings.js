const { retryFailedRefunds } = require('../controllers/paymentController');

cron.schedule('*/10 * * * *', async () => {
  try {
    const result = await retryFailedRefunds();
    if (result.retried > 0) {
      console.log(`[refund-retry-job] retried ${result.retried}/${result.scanned} failed refunds`);
    }
  } catch (err) {
    console.error('[refund-retry-job] sweep failed:', err);
  }
});