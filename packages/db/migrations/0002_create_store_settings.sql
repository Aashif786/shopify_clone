CREATE TABLE store_settings (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  contact_email TEXT,
  contact_phone TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT store_settings_store_id_unique UNIQUE (store_id)
);

CREATE INDEX store_settings_store_id_idx ON store_settings (store_id);
