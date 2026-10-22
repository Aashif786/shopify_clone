# Inventory Availability, Low-Stock Indicators & Purchase Limits

This document specifies the availability calculation, low-stock thresholding, maximum order quantity policies, and server-side enforcement rules implemented for Cal Cart.

---

## 1. Authoritative Inventory Source of Truth

The `Inventory` domain (`modules/inventory`) is the single authoritative source of stock state.

- **Available Quantity (`available_quantity`):** Unreserved physical stock ready for immediate purchase reservation.
- **Reserved Quantity (`reserved_quantity`):** Stock allocated to open, payable checkout sessions.
- **Total Physical Stock:**
  $$\text{Total} = \text{available\_quantity} + \text{reserved\_quantity}$$

Neither the Catalog nor the Cart module calculates or persists independent inventory figures.

---

## 2. Low-Stock and Out-of-Stock Indicators

### Configuration & Defaults
- **Default Threshold:** `5` units.
- **Product-Level Configuration:** `products.low_stock_threshold INT NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0)`.
- **Variant-Level Override:** `product_variants.low_stock_threshold INT DEFAULT NULL CHECK (low_stock_threshold IS NULL OR low_stock_threshold >= 0)`.
- **Effective Threshold Resolution:**
  $$\text{effective\_threshold} = \text{variant.lowStockThreshold} \mathbin{??} \text{product.lowStockThreshold} \mathbin{??} 5$$

### Availability States
1. **Out of Stock:**
   $$\text{available\_quantity} \le 0$$
   - Displays `Out of stock` badge.
   - Quantity stepper clamped to `0`.
   - "Add to Cart" button disabled.
2. **Low Stock:**
   $$0 < \text{available\_quantity} \le \text{effective\_threshold}$$
   - Displays `Only X left` alert badge.
3. **In Stock:**
   $$\text{available\_quantity} > \text{effective\_threshold}$$
   - Displays standard `In stock` badge.

---

## 3. Maximum Order Quantity

To prevent bulk hoarding or enforce inventory fairness, merchants can set maximum purchasable quantities per order.

### Configuration & Hierarchy
- **Product-Level Configuration:** `products.max_order_quantity INT DEFAULT NULL CHECK (max_order_quantity IS NULL OR max_order_quantity > 0)`.
- **Variant-Level Override:** `product_variants.max_order_quantity INT DEFAULT NULL CHECK (max_order_quantity IS NULL OR max_order_quantity > 0)`.
- **Effective Max Order Quantity:**
  $$\text{effective\_max\_order} = \text{variant.maxOrderQuantity} \mathbin{??} \text{product.maxOrderQuantity} \mathbin{??} \text{null}$$

### Effective Purchase Limit Formula
The maximum quantity a customer can purchase in a single order is bounded by both current available stock and configured order limits:
$$\text{effective\_max} = \max\left(0, \min\left(\text{available\_quantity}, \text{effective\_max\_order} \mathbin{??} \text{available\_quantity}\right)\right)$$

- If available stock is 3 and max order quantity is 5: the customer may order at most 3 units.
- If available stock is 20 and max order quantity is 5: the customer may order at most 5 units.

---

## 4. Multi-Layer Backend Enforcement

Client-side restrictions are treated as UX affordances; every invariant is strictly enforced server-side.

### A. Cart Add Item (`CartService.addItem`)
- **Stock Check:** Rejects addition if `available_quantity <= 0` with `InsufficientCartStockError`.
- **Aggregated Limit Enforcement:**
  $$\text{target\_quantity} = \text{existing\_item\_quantity} + \text{requested\_quantity}$$
  - Rejects if $\text{target\_quantity} > \text{available\_quantity}$ with `InsufficientCartStockError`.
  - Rejects if $\text{target\_quantity} > \text{effective\_max\_order}$ with `CartItemQuantityExceedsLimitError`.
  - Prevents line-splitting or repeated additions bypassing order limits.

### B. Cart Update Quantity (`CartService.updateItemQuantity`)
- Revalidates target quantity against available stock and max order limit.
- Rejects invalid mutations before writing to database.

### C. Guest Cart Merge (`CartService.mergeCart`)
- Clamps merged item quantity to $\text{effective\_max}$, ensuring guests logging in cannot exceed purchasing caps.

### D. Checkout Creation (`CheckoutService.createCheckoutFromCart`)
- Adding to cart does **not** reserve stock.
- When creating a checkout from a cart, `createCheckoutFromCart` revalidates live stock and order limits for each item:
  - If stock fell below cart item quantity (e.g. concurrent checkout by another user): throws `InsufficientStockError`.
  - If merchant lowered max order quantity: throws `QuantityLimitExceededError`.

### E. Concurrency & Overselling Prevention (`InventoryService.reserveMany`)
- Executed during checkout payment initiation (`POST /payment`).
- Locks inventory items with PostgreSQL `FOR UPDATE` in deterministic variant ID order.
- Guarantees zero overselling under high concurrency.
