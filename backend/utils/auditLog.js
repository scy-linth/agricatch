let ensured = false;

const adminCache = require('./adminCache');

async function ensureAuditTable(pool) {
  if (ensured) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id SERIAL PRIMARY KEY,
      actor_admin_id INTEGER NOT NULL,
      actor_admin_email VARCHAR(255),
      actor_admin_name VARCHAR(255),
      action VARCHAR(100) NOT NULL,
      entity VARCHAR(50) NOT NULL,
      entity_id INTEGER,
      before JSONB,
      after JSONB,
      ip_address VARCHAR(45),
      user_agent TEXT,
      session_id VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Add new columns to existing tables (idempotent)
  await pool.query(`ALTER TABLE admin_audit_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45)`);
  await pool.query(`ALTER TABLE admin_audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT`);
  await pool.query(`ALTER TABLE admin_audit_logs ADD COLUMN IF NOT EXISTS session_id VARCHAR(100)`);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor ON admin_audit_logs(actor_admin_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_entity ON admin_audit_logs(entity, entity_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON admin_audit_logs(action)`);

  ensured = true;
}

async function writeAdminAuditLog(pool, {
  actor_admin_id,
  action,
  entity,
  entity_id = null,
  before = null,
  after = null,
  req = null
}) {
  if (!actor_admin_id) return;
  await ensureAuditTable(pool);

  // Use req.user fields directly instead of querying the DB
  let actor_admin_email = null;
  let actor_admin_name = null;
  if (req && req.user) {
    actor_admin_email = req.user.email || null;
    actor_admin_name = req.user.username || req.user.full_name || null;
  } else {
    try {
      const actorRes = await pool.query(
        'SELECT email, COALESCE(username, full_name) AS display_name FROM users WHERE id = $1',
        [actor_admin_id]
      );
      if (actorRes.rows.length > 0) {
        actor_admin_email = actorRes.rows[0].email || null;
        actor_admin_name = actorRes.rows[0].display_name || null;
      }
    } catch (_) {
      // best-effort fallback for older call sites that do not pass req
    }
  }

  // Extract request context
  const ip_address = req
    ? (String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || null)
    : null;
  const user_agent = req ? (req.headers?.['user-agent'] || null) : null;
  const session_id = req ? (req.headers?.['x-session-id'] || null) : null;

  await pool.query(
    `
      INSERT INTO admin_audit_logs
        (actor_admin_id, actor_admin_email, actor_admin_name, action, entity, entity_id, before, after, ip_address, user_agent, session_id)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11)
    `,
    [
      actor_admin_id,
      actor_admin_email,
      actor_admin_name,
      action,
      entity,
      entity_id,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null,
      ip_address,
      user_agent,
      session_id
    ]
  );

  // Invalidate recent-activity cache for all periods
  adminCache.deleteByPrefix('recent_activity_');
}

module.exports = {
  writeAdminAuditLog,
  ensureAuditTable
};

