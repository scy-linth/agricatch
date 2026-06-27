// Harvest Reminder Scheduler
// Runs daily to send harvest reminders and track overdue products
// Uses Asia/Manila timezone for scheduling

const { pool } = require('../utils/db');
const { broadcastEvent } = require('../utils/realtime');

// Get current date in Asia/Manila timezone
function getManilaDate() {
  const now = new Date();
  const manilaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  return manilaTime;
}

// Calculate days difference between two dates
function getDaysDifference(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  const diffTime = d2 - d1;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

async function runHarvestReminderScheduler() {
  console.log('=== Harvest Reminder Scheduler Started ===');
  console.log('Time:', getManilaDate().toISOString());

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Ensure harvest tracking columns exist
    await client.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS harvest_adjustment_count INTEGER DEFAULT 0");
    await client.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS last_harvest_adjustment_at TIMESTAMP");
    await client.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS harvest_overdue_days INTEGER DEFAULT 0");
    await client.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS reservations_disabled BOOLEAN DEFAULT false");

    const today = getManilaDate();
    const todayStr = today.toISOString().split('T')[0];

    // Get all products with harvest dates
    const productsResult = await client.query(`
      SELECT p.id, p.name, p.farmer_id, p.harvest_date, p.harvest_overdue_days, p.reservations_disabled
      FROM products p
      WHERE p.harvest_date IS NOT NULL
        AND p.is_admin_disabled = false
        AND p.status = 'approved'
    `);

    console.log(`Found ${productsResult.rows.length} products with harvest dates`);

    for (const product of productsResult.rows) {
      const harvestDate = new Date(product.harvest_date);
      const daysUntilHarvest = getDaysDifference(today, harvestDate);
      const overdueDays = daysUntilHarvest < 0 ? Math.abs(daysUntilHarvest) : 0;

      console.log(`Product ${product.id} (${product.name}): ${daysUntilHarvest} days until harvest`);

      // Update overdue days counter
      if (overdueDays > 0) {
        await client.query(`
          UPDATE products
          SET harvest_overdue_days = $1
          WHERE id = $2
        `, [overdueDays, product.id]);
      }

      // Reservation threshold: Disable new reservations after 7 consecutive overdue days
      if (overdueDays >= 7 && !product.reservations_disabled) {
        await client.query(`
          UPDATE products
          SET reservations_disabled = true
          WHERE id = $1
        `, [product.id]);
        console.log(`  -> Reservations disabled for product ${product.id} (7+ days overdue)`);
      }

      // Send farmer notifications based on harvest timing
      let notificationType = null;
      let notificationTitle = null;
      let notificationMessage = null;

      if (daysUntilHarvest === 7) {
        notificationType = 'harvest_reminder_7days';
        notificationTitle = 'Expected harvest in 7 days';
        notificationMessage = `Your product "${product.name}" is expected to be harvested in 7 days (${product.harvest_date}). Prepare for harvest conversion.`;
      } else if (daysUntilHarvest === 3) {
        notificationType = 'harvest_reminder_3days';
        notificationTitle = 'Expected harvest in 3 days';
        notificationMessage = `Your product "${product.name}" is expected to be harvested in 3 days (${product.harvest_date}). Prepare for harvest conversion.`;
      } else if (daysUntilHarvest === 1) {
        notificationType = 'harvest_reminder_1day';
        notificationTitle = 'Expected harvest tomorrow';
        notificationMessage = `Your product "${product.name}" is expected to be harvested tomorrow (${product.harvest_date}). Prepare for harvest conversion.`;
      } else if (daysUntilHarvest === 0) {
        notificationType = 'harvest_reminder_today';
        notificationTitle = 'Expected harvest today';
        notificationMessage = `Your product "${product.name}" is expected to be harvested today (${product.harvest_date}). Perform harvest conversion when ready.`;
      } else if (overdueDays > 0) {
        // Overdue: Send reminder every day
        notificationType = 'harvest_overdue';
        notificationTitle = 'Harvest Update Required';
        notificationMessage = `Expected harvest date for "${product.name}" passed ${overdueDays} day${overdueDays > 1 ? 's' : ''} ago (${product.harvest_date}). Please perform Harvest Conversion or update Expected Harvest Date.`;
      }

      // Send notification if applicable
      if (notificationType && notificationTitle && notificationMessage) {
        try {
          // Check if we already sent this type of notification today to avoid duplicates
          const existingNotif = await client.query(`
            SELECT id FROM notifications
            WHERE user_id = $1
              AND type = $2
              AND product_id = $3
              AND DATE(created_at AT TIME ZONE 'Asia/Manila') = $4
          `, [product.farmer_id, notificationType, product.id, todayStr]);

          if (existingNotif.rows.length === 0) {
            await client.query(`
              INSERT INTO notifications (user_id, type, title, message, product_id, is_read, created_at)
              VALUES ($1, $2, $3, $4, $5, false, CURRENT_TIMESTAMP)
            `, [product.farmer_id, notificationType, notificationTitle, notificationMessage, product.id]);
            broadcastEvent('notification.created', { user_id: product.farmer_id });
            console.log(`  -> Sent ${notificationType} notification to farmer ${product.farmer_id}`);
          } else {
            console.log(`  -> Skipped duplicate ${notificationType} notification`);
          }
        } catch (notifErr) {
          console.error(`Failed to send ${notificationType} notification:`, notifErr);
        }
      }

      // Admin monitoring: Notify if harvest overdue for more than 7 days
      if (overdueDays > 7) {
        try {
          const adminResult = await client.query(
            "SELECT id FROM users WHERE role IN ('admin', 'super_admin') LIMIT 1"
          );
          if (adminResult.rows.length > 0) {
            const existingAdminNotif = await client.query(`
              SELECT id FROM notifications
              WHERE user_id = $1
                AND type = 'harvest_overdue_alert'
                AND product_id = $2
                AND DATE(created_at AT TIME ZONE 'Asia/Manila') = $4
            `, [adminResult.rows[0].id, product.id, todayStr]);

            if (existingAdminNotif.rows.length === 0) {
              await client.query(`
                INSERT INTO notifications (user_id, type, title, message, product_id, is_read, created_at)
                VALUES ($1, 'harvest_overdue_alert', 'Harvest Overdue Alert', $2, $3, false, CURRENT_TIMESTAMP)
              `, [
                adminResult.rows[0].id,
                `Product "${product.name}" (ID: ${product.id}) is ${overdueDays} days overdue. Expected harvest was ${product.harvest_date}.`,
                product.id
              ]);
              broadcastEvent('notification.created', { user_id: adminResult.rows[0].id });
              console.log(`  -> Sent harvest overdue alert to admin`);
            }
          }
        } catch (adminErr) {
          console.error('Failed to send harvest overdue alert to admin:', adminErr);
        }
      }
    }

    await client.query('COMMIT');
    console.log('=== Harvest Reminder Scheduler Completed Successfully ===');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Harvest Reminder Scheduler Error:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run immediately if called directly
if (require.main === module) {
  runHarvestReminderScheduler()
    .then(() => {
      console.log('Scheduler run complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Scheduler run failed:', error);
      process.exit(1);
    });
}

module.exports = { runHarvestReminderScheduler };
