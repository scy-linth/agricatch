ALTER TABLE admin_audit_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
ALTER TABLE admin_audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE admin_audit_logs ADD COLUMN IF NOT EXISTS session_id VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor ON admin_audit_logs(actor_admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_entity ON admin_audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON admin_audit_logs(action);