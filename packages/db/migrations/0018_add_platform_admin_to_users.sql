-- Migration: 0018_add_platform_admin_to_users.sql
-- Description: Adds is_platform_admin flag to users table with default false to support
--              auditable platform-level administration distinct from store memberships.

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS users_platform_admin_idx ON users (is_platform_admin) WHERE is_platform_admin = TRUE;
