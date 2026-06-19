const { pool } = require('../utils/db');
const { broadcastEvent } = require('../utils/realtime');

async function expireSubscriptions() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Find all active subscriptions that have expired
    const expiredResult = await client.query(
      `SELECT id, farmer_id, expires_at
       FROM farmer_subscriptions
       WHERE status = 'active' AND expires_at < CURRENT_TIMESTAMP`
    );

    if (expiredResult.rows.length === 0) {
      console.log('No subscriptions to expire.');
      await client.query('COMMIT');
      return;
    }

    // Update status to expired
    await client.query(
      `UPDATE farmer_subscriptions
       SET status = 'expired', updated_at = CURRENT_TIMESTAMP
       WHERE status = 'active' AND expires_at < CURRENT_TIMESTAMP`
    );

    // Send notifications to affected farmers
    for (const sub of expiredResult.rows) {
      try {
        await client.query(
          `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
           VALUES ($1, 'subscription_expired',
            'Premium Subscription Expired', $2, false, CURRENT_TIMESTAMP)`,
          [sub.farmer_id,
           'Your Premium subscription has expired. Your products are now limited to 10 active listings. Renew your subscription to restore unlimited products and premium features.']
        );
        broadcastEvent('notification.created', { farmer_id: sub.farmer_id });
      } catch (notifErr) {
        console.error('Failed to send expiry notification for farmer', sub.farmer_id, notifErr.message);
      }
    }

    await client.query('COMMIT');
    console.log(`Expired ${expiredResult.rows.length} subscription(s).`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Subscription expiry cron error:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Run if called directly (e.g., via node backend/scripts/expire_subscriptions.js)
if (require.main === module) {
  expireSubscriptions()
    .then(() => {
      console.log('Done.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { expireSubscriptions };
