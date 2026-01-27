let ensured = false;

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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

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
  after = null
}) {
  if (!actor_admin_id) return;
  await ensureAuditTable(pool);

  let actor_admin_email = null;
  let actor_admin_name = null;
  try {
    const actorRes = await pool.query(
      'SELECT email, COALESCE(full_name, username) AS display_name FROM users WHERE id = $1',
      [actor_admin_id]
    );
    if (actorRes.rows.length > 0) {
      actor_admin_email = actorRes.rows[0].email || null;
      actor_admin_name = actorRes.rows[0].display_name || null;
    }
  } catch (_) {
    // best-effort
  }

  await pool.query(
    `
      INSERT INTO admin_audit_logs
        (actor_admin_id, actor_admin_email, actor_admin_name, action, entity, entity_id, before, after)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
    `,
    [
      actor_admin_id,
      actor_admin_email,
      actor_admin_name,
      action,
      entity,
      entity_id,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null
    ]
  );
}

module.exports = {
  writeAdminAuditLog,
  ensureAuditTable
};

