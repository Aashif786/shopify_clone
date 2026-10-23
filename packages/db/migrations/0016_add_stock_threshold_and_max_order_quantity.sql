-- 0016_add_stock_threshold_and_max_order_quantity.sql
-- Add low-stock threshold and maximum order quantity constraints to products and variants.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS low_stock_threshold INT NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS max_order_quantity INT DEFAULT NULL;

ALTER TABLE products
  ADD CONSTRAINT products_low_stock_threshold_check CHECK (low_stock_threshold >= 0),
  ADD CONSTRAINT products_max_order_quantity_check CHECK (max_order_quantity IS NULL OR max_order_quantity > 0);

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS low_stock_threshold INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_order_quantity INT DEFAULT NULL;

ALTER TABLE product_variants
  ADD CONSTRAINT product_variants_low_stock_threshold_check CHECK (low_stock_threshold IS NULL OR low_stock_threshold >= 0),
  ADD CONSTRAINT product_variants_max_order_quantity_check CHECK (max_order_quantity IS NULL OR max_order_quantity > 0);
