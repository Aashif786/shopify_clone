-- Migration: 0033_platform_admin_rbac_and_audit.sql
-- Description: Platform administration foundation: dedicated platform-admin profiles,
--              fine-grained RBAC, independent session tracking, immutable audit logs,
--              security event monitoring, SaaS subscription plans, and feature flags.

-- 1. Platform Admin Profiles
CREATE TABLE IF NOT EXISTS platform_admin_users (
  id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (
    role IN (
      'super_admin',
      'platform_admin',
      'finance_admin',
      'support_admin',
      'security_admin',
      'analyst'
    )
  ),
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_secret TEXT,
  failed_login_count INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS platform_admin_users_role_idx ON platform_admin_users (role);

-- 2. Dedicated Platform Admin Sessions
CREATE TABLE IF NOT EXISTS platform_admin_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  session_token_hash TEXT NOT NULL UNIQUE,
  mfa_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS platform_admin_sessions_user_id_idx ON platform_admin_sessions (user_id);
CREATE INDEX IF NOT EXISTS platform_admin_sessions_expires_at_idx ON platform_admin_sessions (expires_at);
CREATE INDEX IF NOT EXISTS platform_admin_sessions_token_hash_idx ON platform_admin_sessions (session_token_hash);

-- 3. Immutable Platform Audit Logs
CREATE TABLE IF NOT EXISTS platform_audit_logs (
  id UUID PRIMARY KEY,
  actor_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  tenant_id UUID REFERENCES organizations (id) ON DELETE SET NULL,
  store_id UUID REFERENCES stores (id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILURE')),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS platform_audit_logs_actor_id_idx ON platform_audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS platform_audit_logs_action_idx ON platform_audit_logs (action);
CREATE INDEX IF NOT EXISTS platform_audit_logs_resource_idx ON platform_audit_logs (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS platform_audit_logs_tenant_id_idx ON platform_audit_logs (tenant_id);
CREATE INDEX IF NOT EXISTS platform_audit_logs_store_id_idx ON platform_audit_logs (store_id);
CREATE INDEX IF NOT EXISTS platform_audit_logs_created_at_idx ON platform_audit_logs (created_at DESC);

-- Trigger to enforce strict append-only immutability on audit logs
CREATE OR REPLACE FUNCTION prevent_platform_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Platform audit logs are strictly append-only and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_platform_audit_log_mutation ON platform_audit_logs;
CREATE TRIGGER trg_prevent_platform_audit_log_mutation
BEFORE UPDATE OR DELETE ON platform_audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_platform_audit_log_mutation();

-- 4. Platform Security Events
CREATE TABLE IF NOT EXISTS platform_security_events (
  id UUID PRIMARY KEY,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO')),
  user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS platform_security_events_type_idx ON platform_security_events (event_type);
CREATE INDEX IF NOT EXISTS platform_security_events_severity_idx ON platform_security_events (severity);
CREATE INDEX IF NOT EXISTS platform_security_events_user_id_idx ON platform_security_events (user_id);
CREATE INDEX IF NOT EXISTS platform_security_events_created_at_idx ON platform_security_events (created_at DESC);

-- 5. SaaS Subscription Plans
CREATE TABLE IF NOT EXISTS platform_plans (
  id UUID PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  monthly_price_cents INT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  max_stores INT NOT NULL DEFAULT 1,
  max_products_per_store INT NOT NULL DEFAULT 100,
  transaction_fee_basis_points INT NOT NULL DEFAULT 200,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default standard plans
INSERT INTO platform_plans (id, code, name, description, monthly_price_cents, currency, max_stores, max_products_per_store, transaction_fee_basis_points, features)
VALUES
  ('a0000000-0000-4000-8000-000000000001', 'starter', 'Starter Plan', 'Essential tools for emerging merchants', 199900, 'INR', 1, 250, 200, '["basic_analytics", "standard_checkout", "single_store", "email_support"]'::jsonb),
  ('a0000000-0000-4000-8000-000000000002', 'growth', 'Growth Plan', 'Scaling stores with custom domains & advanced promotions', 499900, 'INR', 5, 2500, 150, '["advanced_analytics", "custom_domains", "abandoned_cart_recovery", "priority_support", "staff_roles"]'::jsonb),
  ('a0000000-0000-4000-8000-000000000003', 'enterprise', 'Enterprise Scale', 'Full control, dedicated limits & SLA guarantees', 1499900, 'INR', 25, 50000, 75, '["dedicated_account_manager", "audit_export", "custom_integrations", "unlimited_variants", "sla_guarantee"]'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- 6. Organization Subscriptions
CREATE TABLE IF NOT EXISTS platform_subscriptions (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
  plan_id UUID NOT NULL REFERENCES platform_plans (id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED')),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS platform_subscriptions_org_id_idx ON platform_subscriptions (organization_id);
CREATE INDEX IF NOT EXISTS platform_subscriptions_status_idx ON platform_subscriptions (status);

-- Auto-provision Starter subscription for any existing organizations without one
INSERT INTO platform_subscriptions (id, organization_id, plan_id, status, current_period_start, current_period_end)
SELECT
  gen_random_uuid(),
  o.id,
  'a0000000-0000-4000-8000-000000000001',
  'ACTIVE',
  o.created_at,
  o.created_at + INTERVAL '30 days'
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM platform_subscriptions ps WHERE ps.organization_id = o.id
);

-- 7. Platform Feature Flags
CREATE TABLE IF NOT EXISTS platform_feature_flags (
  id UUID PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  scope_type TEXT NOT NULL DEFAULT 'GLOBAL' CHECK (scope_type IN ('GLOBAL', 'TENANT', 'STORE')),
  target_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  rollout_percentage INT NOT NULL DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO platform_feature_flags (id, key, name, description, enabled, scope_type, rollout_percentage)
VALUES
  ('b0000000-0000-4000-8000-000000000001', 'realtime_telemetry', 'Realtime Telemetry', 'Streams low-latency operational telemetry to the control center', true, 'GLOBAL', 100),
  ('b0000000-0000-4000-8000-000000000002', 'advanced_fraud_detection', 'Payment Risk Shield', 'Applies automated heuristic scoring to incoming payment attempts', false, 'GLOBAL', 0),
  ('b0000000-0000-4000-8000-000000000003', 'automated_reconciliation', 'Self-Healing Reconciliation', 'Permits automated worker reconciliation for orphaned captured payments', true, 'GLOBAL', 100),
  ('b0000000-0000-4000-8000-000000000004', 'maintenance_mode', 'Platform Maintenance Mode', 'Places non-critical platform services in read-only mode', false, 'GLOBAL', 0)
ON CONFLICT (key) DO NOTHING;

-- 8. Platform System Governance & Configuration
CREATE TABLE IF NOT EXISTS platform_system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  updated_by UUID REFERENCES users (id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO platform_system_settings (key, value, description)
VALUES
  ('general', '{"platform_name": "Cal Cart", "support_email": "ops@calcart.com", "incident_pager_enabled": true, "max_login_attempts": 5, "session_inactivity_minutes": 120}'::jsonb, 'Core platform operational parameters'),
  ('security', '{"enforce_mfa_privileged": true, "session_timeout_minutes": 480, "ip_allowlist": []}'::jsonb, 'Platform security and administrative access policies')
ON CONFLICT (key) DO NOTHING;
