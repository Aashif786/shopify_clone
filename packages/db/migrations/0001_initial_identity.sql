CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_email_unique UNIQUE (email)
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);

CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE organization_memberships (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT organization_memberships_organization_user_unique UNIQUE (organization_id, user_id)
);

CREATE INDEX organization_memberships_user_id_idx ON organization_memberships (user_id);

CREATE TABLE stores (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL,
  currency TEXT NOT NULL,
  locale TEXT NOT NULL,
  timezone TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT stores_slug_unique UNIQUE (slug),
  CONSTRAINT stores_status_check CHECK (
    status IN ('DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED')
  )
);

CREATE INDEX stores_organization_id_idx ON stores (organization_id);

CREATE TABLE store_memberships (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT store_memberships_store_user_unique UNIQUE (store_id, user_id),
  CONSTRAINT store_memberships_role_check CHECK (role IN ('owner', 'admin', 'staff')),
  CONSTRAINT store_memberships_status_check CHECK (
    status IN ('INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED')
  )
);

CREATE INDEX store_memberships_user_id_idx ON store_memberships (user_id);
