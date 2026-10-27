import { createHash } from "node:crypto";
import type { Database, DatabaseClient } from "@shopify-clone/db";
import { CartRepository } from "@shopify-clone/carts";
import { Checkout, validateCheckoutAddress } from "../domain/checkout.js";
import {
  CartNotActiveError,
  CartNotFoundError,
  CheckoutExpiredError,
  CheckoutNotFoundError,
  CrossStoreCartError,
  CrossStoreCustomerError,
  CrossStoreVariantError,
  CustomerNotFoundError,
  EmptyCartError,
  IdempotencyConflictError,
  InsufficientStockError,
  InvalidCurrencyError,
  ProductVariantNotFoundError,
  ProductVariantUnavailableError,
  QuantityLimitExceededError,
} from "../domain/checkout-errors.js";
import { CheckoutRepository } from "../infrastructure/checkout-repository.js";
import {
  toCheckoutDTO,
  type AddCheckoutItemInput,
  type CheckoutDTO,
  type CreateCheckoutFromCartInput,
  type CreateCheckoutInput,
  type UpdateCheckoutAddressesInput,
  type UpdateCheckoutCustomerInput,
  type UpdateCheckoutItemQuantityInput,
  type UpdateCheckoutTotalsInput,
} from "./dtos.js";

function isDatabase(client: Database | DatabaseClient): client is Database {
  return "withTransaction" in client;
}

async function runInTransaction<T>(
  clientOrDb: Database | DatabaseClient,
  fn: (tx: DatabaseClient) => Promise<T>,
): Promise<T> {
  if (isDatabase(clientOrDb)) {
    return clientOrDb.withTransaction(fn);
  }
  return fn(clientOrDb);
}

function canonicalStringify(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map((item) => canonicalStringify(item)).join(",")}]`;
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const entries = keys.map(
    (key) => `${JSON.stringify(key)}:${canonicalStringify((obj as Record<string, unknown>)[key])}`,
  );
  return `{${entries.join(",")}}`;
}

interface IdempotencyRecord {
  payloadHash: string;
  result: CheckoutDTO;
}

export class CheckoutService {
  private readonly idempotencyStore = new Map<string, IdempotencyRecord>();
  private readonly inFlightOperations = new Map<string, Promise<CheckoutDTO>>();

  constructor(
    private readonly repository: CheckoutRepository = new CheckoutRepository(),
    private readonly cartRepository: CartRepository = new CartRepository(),
  ) {}

  private async executeWithIdempotency(
    storeId: string,
    operation: string,
    key: string | null | undefined,
    payload: unknown,
    executeFn: () => Promise<CheckoutDTO>,
  ): Promise<CheckoutDTO> {
    if (!key) {
      return executeFn();
    }

    const cacheKey = `${storeId}:${operation}:${key}`;
    const payloadHash = canonicalStringify(payload);

    const existing = this.idempotencyStore.get(cacheKey);
    if (existing) {
      if (existing.payloadHash === payloadHash) {
        return existing.result;
      }
      throw new IdempotencyConflictError(
        `Idempotency key '${key}' has already been processed with different parameters`,
        { key, operation },
      );
    }

    const inFlight = this.inFlightOperations.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    const executionPromise = (async () => {
      try {
        const result = await executeFn();
        this.idempotencyStore.set(cacheKey, { payloadHash, result });
        return result;
      } finally {
        this.inFlightOperations.delete(cacheKey);
      }
    })();

    this.inFlightOperations.set(cacheKey, executionPromise);
    return executionPromise;
  }

  async createCheckout(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    input: CreateCheckoutInput,
  ): Promise<CheckoutDTO> {
    return this.executeWithIdempotency(
      storeId,
      "createCheckout",
      input.idempotencyKey,
      { cartId: input.cartId, customerId: input.customerId, email: input.email },
      async () => {
        return runInTransaction(clientOrDb, async (tx) => {
          if (input.customerId) {
            const customer = await this.repository.findCustomer(tx, input.customerId);
            if (!customer) {
              throw new CustomerNotFoundError(`Customer '${input.customerId}' not found`);
            }
            if (customer.storeId !== storeId) {
              throw new CrossStoreCustomerError(
                `Customer '${input.customerId}' does not belong to store '${storeId}'`,
              );
            }
          }

          const checkout = Checkout.create({
            storeId,
            cartId: input.cartId,
            customerId: input.customerId,
            email: input.email,
            currency: input.currency,
            shippingAddress: input.shippingAddress
              ? validateCheckoutAddress(input.shippingAddress)
              : null,
            billingAddress: input.billingAddress
              ? validateCheckoutAddress(input.billingAddress)
              : null,
            expiresAt: input.expiresAt,
          });

          await this.repository.create(tx, checkout);
          return toCheckoutDTO(checkout);
        });
      },
    );
  }

  async createCheckoutFromCart(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    cartId: string,
    options?: CreateCheckoutFromCartInput,
  ): Promise<CheckoutDTO> {
    return this.executeWithIdempotency(
      storeId,
      "createCheckoutFromCart",
      options?.idempotencyKey,
      {
        cartId,
        customerId: options?.customerId,
        email: options?.email,
        shippingAddress: options?.shippingAddress,
      },
      async () => {
        return runInTransaction(clientOrDb, async (tx) => {
          const cart = await this.cartRepository.findWithItems(tx, storeId, cartId, true);
          if (!cart) {
            const crossStoreCheck = await tx.query<{ store_id: string }>(
              `SELECT store_id FROM carts WHERE id = $1`,
              [cartId],
            );
            if (crossStoreCheck.rows[0]) {
              throw new CrossStoreCartError(
                `Cart '${cartId}' does not belong to store '${storeId}'`,
              );
            }
            throw new CartNotFoundError(`Cart '${cartId}' not found in store '${storeId}'`);
          }
          if (cart.status !== "ACTIVE") {
            throw new CartNotActiveError(
              `Cart '${cartId}' is in status '${cart.status}' and cannot be checked out`,
            );
          }
          if (cart.items.length === 0) {
            throw new EmptyCartError(`Cart '${cartId}' contains no items`);
          }

          if (cart.customerId) {
            const effectiveCallerCustId = options?.caller?.customerId ?? options?.customerId;
            if (!effectiveCallerCustId || cart.customerId !== effectiveCallerCustId) {
              throw new CrossStoreCartError(`Caller does not own cart '${cartId}'`);
            }
          } else if (cart.guestIdentifier) {
            if (options?.caller) {
              const callerGuestId = options.caller.guestIdentifier;
              const callerCustId = options.caller.customerId;
              if (
                (!callerGuestId || cart.guestIdentifier !== callerGuestId) &&
                (!callerCustId || cart.customerId !== callerCustId)
              ) {
                throw new CrossStoreCartError(`Caller does not own cart '${cartId}'`);
              }
            }
          }

          // Check if an active (OPEN or PAYMENT_PENDING) checkout already exists for this cart
          const existingCheckout = await this.repository.findOpenByCartId(tx, storeId, cartId, true);
          if (existingCheckout) {
            if (existingCheckout.isExpired()) {
              existingCheckout.markExpired();
              await this.repository.update(tx, existingCheckout);
            } else {
              // Verify that existing checkout items match the current cart items exactly
              const cartItemsMap = new Map();
              for (const ci of cart.items) {
                cartItemsMap.set(ci.variantId, ci.quantity);
              }
              const checkoutItemsMap = new Map();
              for (const item of existingCheckout.items) {
                checkoutItemsMap.set(item.variantId, item.quantity);
              }

              let itemsMatch = cartItemsMap.size === checkoutItemsMap.size;
              if (itemsMatch) {
                for (const [varId, qty] of cartItemsMap.entries()) {
                  if (checkoutItemsMap.get(varId) !== qty) {
                    itemsMatch = false;
                    break;
                  }
                }
              }

              if (itemsMatch) {
                let needsUpdate = false;
                if (options?.guestTokenHash && existingCheckout.guestTokenHash !== options.guestTokenHash) {
                  existingCheckout.setGuestTokenHash(options.guestTokenHash);
                  needsUpdate = true;
                }
                if (options?.email && !existingCheckout.email) {
                  existingCheckout.setEmail(options.email);
                  needsUpdate = true;
                }
                if (needsUpdate) {
                  await this.repository.update(tx, existingCheckout);
                }
                return toCheckoutDTO(existingCheckout);
              }

              // Cart items have changed (added, removed, or quantity altered).
              // Cancel the stale checkout so a fresh checkout matching the current cart is created.
              existingCheckout.markCancelled();
              await this.repository.update(tx, existingCheckout);
            }
          }

          const customerId = options?.customerId !== undefined ? options.customerId : cart.customerId;
          if (customerId) {
            const customer = await this.repository.findCustomer(tx, customerId);
            if (!customer) {
              throw new CustomerNotFoundError(`Customer '${customerId}' not found`);
            }
            if (customer.storeId !== storeId) {
              throw new CrossStoreCustomerError(
                `Customer '${customerId}' does not belong to store '${storeId}'`,
              );
            }
          }

          const checkoutItems = [];
          for (const cartItem of cart.items) {
            const variant = await this.repository.findVariantWithProduct(tx, cartItem.variantId);
            if (!variant) {
              throw new ProductVariantNotFoundError(
                `Product variant '${cartItem.variantId}' not found`,
              );
            }
            if (variant.storeId !== storeId) {
              throw new CrossStoreVariantError(
                `Product variant '${cartItem.variantId}' does not belong to store '${storeId}'`,
              );
            }
            if (variant.variantStatus !== "ACTIVE" || variant.productStatus !== "ACTIVE") {
              throw new ProductVariantUnavailableError(
                `Product variant '${cartItem.variantId}' is unavailable for purchase`,
              );
            }
            if (variant.currency && variant.currency !== cart.currency) {
              throw new InvalidCurrencyError(
                `Product variant currency '${variant.currency}' does not match cart currency '${cart.currency}'`,
              );
            }

            // Re-validate stock availability at checkout creation time
            if (cartItem.quantity > variant.availableQuantity) {
              throw new InsufficientStockError(
                `Insufficient stock for '${variant.productTitle} - ${variant.variantTitle}'. Available: ${variant.availableQuantity}, requested: ${cartItem.quantity}`,
                {
                  variantId: cartItem.variantId,
                  availableQuantity: variant.availableQuantity,
                  requestedQuantity: cartItem.quantity,
                },
              );
            }

            // Re-validate max order quantity limit
            if (
              variant.maxOrderQuantity !== null &&
              cartItem.quantity > variant.maxOrderQuantity
            ) {
              throw new QuantityLimitExceededError(
                `Requested quantity of ${cartItem.quantity} exceeds maximum order limit of ${variant.maxOrderQuantity} for '${variant.productTitle} - ${variant.variantTitle}'`,
                {
                  variantId: cartItem.variantId,
                  maxOrderQuantity: variant.maxOrderQuantity,
                  requestedQuantity: cartItem.quantity,
                },
              );
            }

            checkoutItems.push({
              variantId: cartItem.variantId,
              productNameSnapshot: variant.productTitle,
              variantNameSnapshot: variant.variantTitle,
              skuSnapshot: variant.sku,
              unitPrice: variant.price,
              quantity: cartItem.quantity,
            });
          }

          const checkout = Checkout.create({
            storeId,
            cartId,
            customerId,
            email: options?.email ?? null,
            currency: cart.currency,
            shippingAddress: options?.shippingAddress
              ? validateCheckoutAddress(options.shippingAddress)
              : null,
            billingAddress: options?.billingAddress
              ? validateCheckoutAddress(options.billingAddress)
              : null,
            expiresAt: options?.expiresAt ?? null,
            guestTokenHash: options?.guestTokenHash ?? null,
            items: checkoutItems,
          });

          if (cart.discountTotal > 0) {
            checkout.setDiscount(cart.discountTotal, cart.discountId, cart.discountCode);
          }

          await this.repository.create(tx, checkout);
          return toCheckoutDTO(checkout);
        });
      },
    );
  }

  assertCheckoutOwnership(
    checkout: CheckoutDTO,
    caller: {
      customerId?: string | null;
      guestToken?: string | null;
    },
  ): void {
    if (checkout.customerId && caller.customerId && checkout.customerId === caller.customerId) {
      return;
    }
    if (checkout.guestTokenHash && caller.guestToken) {
      const callerHash = createHash("sha256").update(caller.guestToken.trim()).digest("hex");
      if (callerHash === checkout.guestTokenHash) {
        return;
      }
    }
    throw new CheckoutNotFoundError(`Checkout '${checkout.id}' not found`);
  }

  async getCheckout(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    checkoutId: string,
  ): Promise<CheckoutDTO> {
    const checkout = await this.repository.findWithItems(clientOrDb, storeId, checkoutId);
    if (!checkout) {
      throw new CheckoutNotFoundError(
        `Checkout '${checkoutId}' not found in store '${storeId}'`,
      );
    }
    return toCheckoutDTO(checkout);
  }

  async getCheckoutByCartId(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    cartId: string,
  ): Promise<CheckoutDTO | null> {
    const checkout = await this.repository.findWithItems(clientOrDb, storeId, cartId);
    if (!checkout) {
      return null;
    }
    return toCheckoutDTO(checkout);
  }

  async addItem(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    checkoutId: string,
    input: AddCheckoutItemInput,
  ): Promise<CheckoutDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const checkout = await this.repository.findWithItems(tx, storeId, checkoutId, true);
      if (!checkout) {
        throw new CheckoutNotFoundError(
          `Checkout '${checkoutId}' not found in store '${storeId}'`,
        );
      }

      const variant = await this.repository.findVariantWithProduct(tx, input.variantId);
      if (!variant) {
        throw new ProductVariantNotFoundError(`Product variant '${input.variantId}' not found`);
      }
      if (variant.storeId !== storeId) {
        throw new CrossStoreVariantError(
          `Product variant '${input.variantId}' does not belong to store '${storeId}'`,
        );
      }
      if (variant.variantStatus !== "ACTIVE" || variant.productStatus !== "ACTIVE") {
        throw new ProductVariantUnavailableError(
          `Product variant '${input.variantId}' is unavailable for purchase`,
        );
      }
      if (variant.currency && variant.currency !== checkout.currency) {
        throw new InvalidCurrencyError(
          `Product variant currency '${variant.currency}' does not match checkout currency '${checkout.currency}'`,
        );
      }

      const item = checkout.addItem({
        variantId: input.variantId,
        productNameSnapshot: variant.productTitle,
        variantNameSnapshot: variant.variantTitle,
        skuSnapshot: variant.sku,
        unitPrice: variant.price,
        quantity: input.quantity,
      });

      await this.repository.saveItem(tx, item);
      await this.repository.update(tx, checkout);

      return toCheckoutDTO(checkout);
    });
  }

  async updateItemQuantity(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    checkoutId: string,
    variantId: string,
    input: UpdateCheckoutItemQuantityInput | number,
  ): Promise<CheckoutDTO> {
    const quantity = typeof input === "number" ? input : input.quantity;

    return runInTransaction(clientOrDb, async (tx) => {
      const checkout = await this.repository.findWithItems(tx, storeId, checkoutId, true);
      if (!checkout) {
        throw new CheckoutNotFoundError(
          `Checkout '${checkoutId}' not found in store '${storeId}'`,
        );
      }

      const item = checkout.updateItemQuantity(variantId, quantity);
      await this.repository.saveItem(tx, item);
      await this.repository.update(tx, checkout);

      return toCheckoutDTO(checkout);
    });
  }

  async removeItem(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    checkoutId: string,
    variantId: string,
  ): Promise<CheckoutDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const checkout = await this.repository.findWithItems(tx, storeId, checkoutId, true);
      if (!checkout) {
        throw new CheckoutNotFoundError(
          `Checkout '${checkoutId}' not found in store '${storeId}'`,
        );
      }

      checkout.removeItem(variantId);
      await this.repository.deleteItem(tx, storeId, checkoutId, variantId);
      await this.repository.update(tx, checkout);

      return toCheckoutDTO(checkout);
    });
  }

  async clearItems(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    checkoutId: string,
  ): Promise<CheckoutDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const checkout = await this.repository.findWithItems(tx, storeId, checkoutId, true);
      if (!checkout) {
        throw new CheckoutNotFoundError(
          `Checkout '${checkoutId}' not found in store '${storeId}'`,
        );
      }

      checkout.clearItems();
      await this.repository.clearItems(tx, storeId, checkoutId);
      await this.repository.update(tx, checkout);

      return toCheckoutDTO(checkout);
    });
  }

  async updateCustomer(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    checkoutId: string,
    input: UpdateCheckoutCustomerInput,
  ): Promise<CheckoutDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const checkout = await this.repository.findWithItems(tx, storeId, checkoutId, true);
      if (!checkout) {
        throw new CheckoutNotFoundError(
          `Checkout '${checkoutId}' not found in store '${storeId}'`,
        );
      }

      if (input.customerId) {
        const customer = await this.repository.findCustomer(tx, input.customerId);
        if (!customer) {
          throw new CustomerNotFoundError(`Customer '${input.customerId}' not found`);
        }
        if (customer.storeId !== storeId) {
          throw new CrossStoreCustomerError(
            `Customer '${input.customerId}' does not belong to store '${storeId}'`,
          );
        }
        checkout.setCustomer(input.customerId);
      } else if (input.customerId === null) {
        checkout.setCustomer(null);
      }

      if (input.email !== undefined) {
        checkout.setEmail(input.email);
      }

      await this.repository.update(tx, checkout);
      return toCheckoutDTO(checkout);
    });
  }

  async updateAddresses(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    checkoutId: string,
    input: UpdateCheckoutAddressesInput,
  ): Promise<CheckoutDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const checkout = await this.repository.findWithItems(tx, storeId, checkoutId, true);
      if (!checkout) {
        throw new CheckoutNotFoundError(
          `Checkout '${checkoutId}' not found in store '${storeId}'`,
        );
      }

      if (input.shippingAddress !== undefined) {
        checkout.setShippingAddress(
          input.shippingAddress ? validateCheckoutAddress(input.shippingAddress) : null,
        );
      }
      if (input.billingAddress !== undefined) {
        checkout.setBillingAddress(
          input.billingAddress ? validateCheckoutAddress(input.billingAddress) : null,
        );
      }

      await this.repository.update(tx, checkout);
      return toCheckoutDTO(checkout);
    });
  }

  async updateTotals(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    checkoutId: string,
    input: UpdateCheckoutTotalsInput,
  ): Promise<CheckoutDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const checkout = await this.repository.findWithItems(tx, storeId, checkoutId, true);
      if (!checkout) {
        throw new CheckoutNotFoundError(
          `Checkout '${checkoutId}' not found in store '${storeId}'`,
        );
      }

      if (
        input.discountTotal !== undefined ||
        input.discountId !== undefined ||
        input.discountCode !== undefined
      ) {
        checkout.setDiscount(
          input.discountTotal !== undefined ? input.discountTotal : checkout.discountTotal,
          input.discountId !== undefined ? input.discountId : checkout.discountId,
          input.discountCode !== undefined ? input.discountCode : checkout.discountCode,
        );
      }
      if (input.taxTotal !== undefined) {
        checkout.setTaxTotal(input.taxTotal);
      }
      if (input.shippingTotal !== undefined) {
        checkout.setShippingTotal(input.shippingTotal);
      }

      await this.repository.update(tx, checkout);
      return toCheckoutDTO(checkout);
    });
  }

  // --- Explicit Lifecycle Operations ---

  async beginPayment(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    checkoutId: string,
  ): Promise<CheckoutDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const checkout = await this.repository.findWithItems(tx, storeId, checkoutId, true);
      if (!checkout) {
        throw new CheckoutNotFoundError(
          `Checkout '${checkoutId}' not found in store '${storeId}'`,
        );
      }

      if (checkout.isExpired()) {
        checkout.markExpired();
        await this.repository.update(tx, checkout);
        throw new CheckoutExpiredError("Checkout has expired and cannot enter payment");
      }

      checkout.beginPayment();
      await this.repository.update(tx, checkout);
      return toCheckoutDTO(checkout);
    });
  }

  async completeCheckout(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    checkoutId: string,
    options?: { idempotencyKey?: string },
  ): Promise<CheckoutDTO> {
    return this.executeWithIdempotency(
      storeId,
      "completeCheckout",
      options?.idempotencyKey,
      { checkoutId },
      async () => {
        return runInTransaction(clientOrDb, async (tx) => {
          const checkout = await this.repository.findWithItems(tx, storeId, checkoutId, true);
          if (!checkout) {
            throw new CheckoutNotFoundError(
              `Checkout '${checkoutId}' not found in store '${storeId}'`,
            );
          }

          if (checkout.status === "COMPLETED") {
            if (checkout.cartId) {
              try {
                const cart = await this.cartRepository.findWithItems(tx, storeId, checkout.cartId, true);
                if (cart && cart.status === "ACTIVE") {
                  cart.markConverted();
                  await this.cartRepository.update(tx, cart);
                }
              } catch (cartErr) {
                console.error(
                  `[completeCheckout] Failed to transition cart '${checkout.cartId}' to CONVERTED:`,
                  cartErr,
                );
              }
            }
            return toCheckoutDTO(checkout);
          }

          if (checkout.isExpired()) {
            checkout.markExpired();
            await this.repository.update(tx, checkout);
            throw new CheckoutExpiredError("Checkout has expired and cannot be completed");
          }

          checkout.markCompleted();
          await this.repository.update(tx, checkout);

          if (checkout.cartId) {
            try {
              const cart = await this.cartRepository.findWithItems(tx, storeId, checkout.cartId, true);
              if (cart && cart.status === "ACTIVE") {
                cart.markConverted();
                await this.cartRepository.update(tx, cart);
              }
            } catch (cartErr) {
              console.error(
                `[completeCheckout] Failed to transition cart '${checkout.cartId}' to CONVERTED:`,
                cartErr,
              );
            }
          }

          return toCheckoutDTO(checkout);
        });
      },
    );
  }

  async cancelCheckout(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    checkoutId: string,
  ): Promise<CheckoutDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const checkout = await this.repository.findWithItems(tx, storeId, checkoutId, true);
      if (!checkout) {
        throw new CheckoutNotFoundError(
          `Checkout '${checkoutId}' not found in store '${storeId}'`,
        );
      }

      if (checkout.status === "CANCELLED") {
        return toCheckoutDTO(checkout);
      }

      checkout.markCancelled();
      await this.repository.update(tx, checkout);
      return toCheckoutDTO(checkout);
    });
  }

  async expireCheckout(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    checkoutId: string,
  ): Promise<CheckoutDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const checkout = await this.repository.findWithItems(tx, storeId, checkoutId, true);
      if (!checkout) {
        throw new CheckoutNotFoundError(
          `Checkout '${checkoutId}' not found in store '${storeId}'`,
        );
      }

      if (checkout.status === "EXPIRED") {
        return toCheckoutDTO(checkout);
      }

      checkout.markExpired();
      await this.repository.update(tx, checkout);
      return toCheckoutDTO(checkout);
    });
  }

  async failCheckout(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    checkoutId: string,
  ): Promise<CheckoutDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const checkout = await this.repository.findWithItems(tx, storeId, checkoutId, true);
      if (!checkout) {
        throw new CheckoutNotFoundError(
          `Checkout '${checkoutId}' not found in store '${storeId}'`,
        );
      }

      if (checkout.status === "FAILED") {
        return toCheckoutDTO(checkout);
      }

      checkout.markFailed();
      await this.repository.update(tx, checkout);
      return toCheckoutDTO(checkout);
    });
  }

  async reopenFromPaymentFailure(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    checkoutId: string,
  ): Promise<CheckoutDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const checkout = await this.repository.findWithItems(tx, storeId, checkoutId, true);
      if (!checkout) {
        throw new CheckoutNotFoundError(
          `Checkout '${checkoutId}' not found in store '${storeId}'`,
        );
      }

      if (checkout.status === "OPEN") {
        return toCheckoutDTO(checkout);
      }

      checkout.markPaymentFailed();
      await this.repository.update(tx, checkout);
      return toCheckoutDTO(checkout);
    });
  }

  async findExpiredCheckouts(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    cutoff: Date = new Date(),
    limit = 50,
  ): Promise<CheckoutDTO[]> {
    const checkouts = await this.repository.findExpiredCheckouts(
      clientOrDb,
      storeId,
      cutoff,
      limit,
    );
    return checkouts.map((c) => toCheckoutDTO(c));
  }

  async expireStaleCheckouts(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    cutoff: Date = new Date(),
    limit = 50,
  ): Promise<number> {
    const staleList = await this.repository.findExpiredCheckouts(
      clientOrDb,
      storeId,
      cutoff,
      limit,
    );
    let expiredCount = 0;

    for (const stale of staleList) {
      await runInTransaction(clientOrDb, async (tx) => {
        const checkout = await this.repository.findWithItems(tx, storeId, stale.id, true);
        if (
          checkout &&
          (checkout.status === "OPEN" || checkout.status === "PAYMENT_PENDING") &&
          checkout.isExpired(cutoff)
        ) {
          checkout.markExpired();
          await this.repository.update(tx, checkout);
          expiredCount++;
        }
      });
    }

    return expiredCount;
  }
}
