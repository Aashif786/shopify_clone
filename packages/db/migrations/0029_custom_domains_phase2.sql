-- Migration: 0029_custom_domains_phase2.sql
-- Description: Extend store_domains table with custom domain verification, DNS instructions, and SSL status

ALTER TABLE store_domains
  ADD COLUMN IF NOT EXISTS verification_challenge JSONB,
  ADD COLUMN IF NOT EXISTS dns_instructions JSONB,
  ADD COLUMN IF NOT EXISTS error_reason TEXT,
  ADD COLUMN IF NOT EXISTS ssl_status TEXT DEFAULT 'PENDING';

-- Add check constraint for ssl_status if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'store_domains_ssl_status_check'
  ) THEN
    ALTER TABLE store_domains
      ADD CONSTRAINT store_domains_ssl_status_check
      CHECK (ssl_status IN ('PENDING', 'ACTIVE', 'ERROR'));
  END IF;
END $$;

-- Update existing active subdomains to have ssl_status = 'ACTIVE'
UPDATE store_domains
SET ssl_status = 'ACTIVE'
WHERE type = 'SUBDOMAIN' AND status = 'ACTIVE';
