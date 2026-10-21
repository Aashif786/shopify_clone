-- Migration: 0012_create_auth_tokens_and_invitations.sql
-- Description: Creates password_reset_tokens and store_invitations tables with security constraints,
--              expiration tracking, and index optimizations.

-- 1. Password Reset Tokens Table
CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX password_reset_tokens_user_id_idx ON password_reset_tokens (user_id);
CREATE INDEX password_reset_tokens_token_hash_idx ON password_reset_tokens (token_hash);
CREATE INDEX password_reset_tokens_expires_at_idx ON password_reset_tokens (expires_at);

-- 2. Store Invitations Table
CREATE TABLE store_invitations (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  invited_by_user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT store_invitations_role_check CHECK (role IN ('owner', 'admin', 'staff')),
  CONSTRAINT store_invitations_status_check CHECK (status IN ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED')),
  CONSTRAINT store_invitations_email_check CHECK (email = LOWER(TRIM(email)) AND LENGTH(email) > 0)
);

CREATE INDEX store_invitations_store_id_idx ON store_invitations (store_id);
CREATE INDEX store_invitations_email_idx ON store_invitations (email);
CREATE INDEX store_invitations_token_hash_idx ON store_invitations (token_hash);
CREATE INDEX store_invitations_store_status_idx ON store_invitations (store_id, status);
