-- Rollback: add_audit_log_fields.sql
-- Removes ip_address, user_agent, session_id columns and their indexes from admin_audit_logs
DROP INDEX IF EXISTS idx_admin_audit_logs_created_at;
DROP INDEX IF EXISTS idx_admin_audit_logs_actor;
DROP INDEX IF EXISTS idx_admin_audit_logs_entity;
DROP INDEX IF EXISTS idx_admin_audit_logs_action;
ALTER TABLE admin_audit_logs DROP COLUMN IF EXISTS ip_address;
ALTER TABLE admin_audit_logs DROP COLUMN IF EXISTS user_agent;
ALTER TABLE admin_audit_logs DROP COLUMN IF EXISTS session_id;
