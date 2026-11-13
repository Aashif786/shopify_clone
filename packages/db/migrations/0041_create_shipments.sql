-- Migration: 0041_create_shipments.sql
-- Description: One shipment per order. Dispatch records the carrier the merchant
--              named (the manual provider) instead of calling a carrier API.
--              Delivery outcomes reuse the same row later; they are not written here.

CREATE TABLE shipments (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  order_id UUID NOT NULL,
  provider_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DISPATCHED',
  carrier_name TEXT NOT NULL,
  tracking_number TEXT,
  tracking_url TEXT,
  carrier_status TEXT,
  dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT shipments_store_order_fkey FOREIGN KEY (order_id, store_id)
    REFERENCES orders (id, store_id) ON DELETE RESTRICT,
  CONSTRAINT shipments_store_order_unique UNIQUE (store_id, order_id),
  CONSTRAINT shipments_status_check CHECK (status IN (
    'DISPATCHED',
    'DELIVERED',
    'DELIVERY_FAILED'
  )),
  CONSTRAINT shipments_provider_code_check CHECK (
    provider_code = lower(provider_code)
    AND char_length(provider_code) BETWEEN 1 AND 40
  ),
  CONSTRAINT shipments_carrier_name_check CHECK (
    char_length(btrim(carrier_name)) BETWEEN 1 AND 120
  ),
  CONSTRAINT shipments_tracking_number_check CHECK (
    tracking_number IS NULL OR char_length(btrim(tracking_number)) BETWEEN 1 AND 80
  ),
  CONSTRAINT shipments_tracking_url_check CHECK (
    tracking_url IS NULL OR char_length(tracking_url) BETWEEN 1 AND 500
  ),
  CONSTRAINT shipments_carrier_status_check CHECK (
    carrier_status IS NULL OR char_length(btrim(carrier_status)) BETWEEN 1 AND 200
  )
);

CREATE INDEX shipments_store_status_idx ON shipments (store_id, status, dispatched_at DESC);
