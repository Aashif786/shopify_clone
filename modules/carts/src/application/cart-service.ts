import type { Database, DatabaseClient } from "@shopify-clone/db";
import { Cart } from "../domain/cart.js";
import {
  CartAccessDeniedError,
  CartItemNotFoundError,
  CartItemQuantityExceedsLimitError,
  CartNotFoundError,
  CrossStoreCustomerError,
  CrossStoreVariantError,
  CustomerNotFoundError,
  InsufficientCartStockError,
  InvalidCurrencyError,
  ProductVariantNotFoundError,
  ProductVariantUnavailableError,
} from "../domain/cart-errors.js";
import type { CartStatus } from "../domain/cart-state.js";
import { CartRepository } from "../infrastructure/cart-repository.js";
import {
  toCartDTO,
  toCartItemDTO,
  type AddCartItemInput,
  type CartDTO,
  type CartItemDTO,
  type CreateCartInput,
  type UpdateCartItemQuantityInput,
} from "./dtos.js";

export interface CartCallerContext {
  customerId?: string | null;
  guestIdentifier?: string | null;
}

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

export class CartService {
  constructor(
    private readonly repository: CartRepository = new CartRepository(),
  ) {}

  async createCart(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    input?: CreateCartInput,
  ): Promise<CartDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      if (input?.customerId) {
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

      const storeCurrency =
        (await this.repository.findStoreCurrency(tx, storeId)) ||
        "USD";

      const cart = Cart.create({
        storeId,
        customerId: input?.customerId,
        guestIdentifier: input?.guestIdentifier,
        currency: storeCurrency,
        expiresAt: input?.expiresAt,
      });

      await this.repository.create(tx, cart);
      return toCartDTO(cart);
    });
  }

  assertCartOwnership(
    cart: Cart | CartDTO,
    caller?: CartCallerContext,
  ): void {
    if (!caller) return;

    if (cart.customerId) {
      if (!caller.customerId || cart.customerId !== caller.customerId) {
        throw new CartAccessDeniedError(
          `Access denied to customer cart '${cart.id}'`,
        );
      }
      return;
    }

    if (cart.guestIdentifier) {
      if (
        caller.guestIdentifier &&
        cart.guestIdentifier === caller.guestIdentifier
      ) {
        return;
      }
      if (caller.customerId && cart.customerId === caller.customerId) {
        return;
      }
      throw new CartAccessDeniedError(
        `Access denied to guest cart '${cart.id}'`,
      );
    }
  }

  async mergeCart(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    guestIdentifier: string,
    customerId: string,
  ): Promise<CartDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const customer = await this.repository.findCustomer(tx, customerId);
      if (!customer || customer.storeId !== storeId) {
        throw new CustomerNotFoundError(
          `Customer '${customerId}' not found in store '${storeId}'`,
        );
      }

      const guestCart = await this.repository.findActiveByGuestIdentifier(
        tx,
        storeId,
        guestIdentifier,
        true,
      );
      if (!guestCart || guestCart.items.length === 0) {
        return this.getOrCreateCart(tx, storeId, { customerId });
      }

      const customerCart = await this.repository.findActiveByCustomerId(
        tx,
        storeId,
        customerId,
        true,
      );

      if (!customerCart) {
        guestCart.assignCustomer(customerId);
        await this.repository.update(tx, guestCart);
        return toCartDTO(guestCart);
      }

      if (customerCart.id === guestCart.id) {
        return toCartDTO(customerCart);
      }

      // Merge items from guestCart into customerCart
      for (const guestItem of guestCart.items) {
        const variant = await this.repository.findVariant(tx, guestItem.variantId);
        const existing = customerCart.getItem(guestItem.variantId);
        const availableQty = variant ? variant.availableQuantity : 999;
        const maxOrderQty = variant?.maxOrderQuantity ?? availableQty;
        const effectiveLimit = Math.max(0, Math.min(availableQty, maxOrderQty));

        if (existing) {
          const newQty = Math.min(effectiveLimit > 0 ? effectiveLimit : 999, existing.quantity + guestItem.quantity);
          const updated = customerCart.updateItemQuantity(guestItem.variantId, newQty);
          if (updated) {
            await this.repository.saveItem(tx, updated);
          }
        } else {
          const qty = Math.min(effectiveLimit > 0 ? effectiveLimit : 999, guestItem.quantity);
          if (qty > 0) {
            const newItem = customerCart.addItem({
              variantId: guestItem.variantId,
              quantity: qty,
              unitPrice: guestItem.unitPrice,
            });
            await this.repository.saveItem(tx, newItem);
          }
        }
      }

      guestCart.transitionTo("CONVERTED");
      await this.repository.update(tx, guestCart);
      await this.repository.update(tx, customerCart);

      return toCartDTO(customerCart);
    });
  }

  async getCart(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    cartId: string,
    caller?: CartCallerContext,
  ): Promise<CartDTO> {
    const cart = await this.repository.findWithItems(clientOrDb, storeId, cartId);
    if (!cart) {
      throw new CartNotFoundError(`Cart '${cartId}' not found in store '${storeId}'`);
    }
    this.assertCartOwnership(cart, caller);
    return toCartDTO(cart);
  }

  async getActiveCartForCustomer(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    customerId: string,
  ): Promise<CartDTO | null> {
    const customer = await this.repository.findCustomer(clientOrDb, customerId);
    if (!customer) {
      throw new CustomerNotFoundError(`Customer '${customerId}' not found`);
    }
    if (customer.storeId !== storeId) {
      throw new CrossStoreCustomerError(
        `Customer '${customerId}' does not belong to store '${storeId}'`,
      );
    }

    const cart = await this.repository.findActiveByCustomerId(
      clientOrDb,
      storeId,
      customerId,
    );
    if (!cart) {
      return null;
    }
    return toCartDTO(cart);
  }

  async getActiveCartForGuest(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    guestIdentifier: string,
  ): Promise<CartDTO | null> {
    const cart = await this.repository.findActiveByGuestIdentifier(
      clientOrDb,
      storeId,
      guestIdentifier,
    );
    if (!cart) {
      return null;
    }
    return toCartDTO(cart);
  }

  async getOrCreateCart(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    params?: {
      customerId?: string | null;
      guestIdentifier?: string | null;
      currency?: string;
    },
  ): Promise<CartDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const storeCurrency =
        (await this.repository.findStoreCurrency(tx, storeId)) ||
        "USD";

      if (params?.customerId) {
        const customer = await this.repository.findCustomer(tx, params.customerId);
        if (!customer) {
          throw new CustomerNotFoundError(`Customer '${params.customerId}' not found`);
        }
        if (customer.storeId !== storeId) {
          throw new CrossStoreCustomerError(
            `Customer '${params.customerId}' does not belong to store '${storeId}'`,
          );
        }

        const existing = await this.repository.findActiveByCustomerId(
          tx,
          storeId,
          params.customerId,
          true,
        );
        if (existing) {
          if (existing.currency !== storeCurrency && existing.items.length === 0) {
            existing.setCurrency(storeCurrency);
            await this.repository.update(tx, existing);
          }
          return toCartDTO(existing);
        }
      } else if (params?.guestIdentifier) {
        const existing = await this.repository.findActiveByGuestIdentifier(
          tx,
          storeId,
          params.guestIdentifier,
          true,
        );
        if (existing) {
          if (existing.currency !== storeCurrency && existing.items.length === 0) {
            existing.setCurrency(storeCurrency);
            await this.repository.update(tx, existing);
          }
          return toCartDTO(existing);
        }
      }

      const cart = Cart.create({
        storeId,
        customerId: params?.customerId,
        guestIdentifier: params?.guestIdentifier,
        currency: storeCurrency,
      });

      await this.repository.create(tx, cart);
      return toCartDTO(cart);
    });
  }

  async updateCartCurrency(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    cartId: string,
    currency: string,
  ): Promise<CartDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const cart = await this.repository.findWithItems(tx, storeId, cartId, true);
      if (!cart) {
        throw new CartNotFoundError(`Cart '${cartId}' not found in store '${storeId}'`);
      }
      cart.setCurrency(currency);
      await this.repository.update(tx, cart);
      return toCartDTO(cart);
    });
  }

  async addItem(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    cartId: string,
    input: AddCartItemInput,
    caller?: CartCallerContext,
  ): Promise<CartDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const cart = await this.repository.findWithItems(tx, storeId, cartId, true);
      if (!cart) {
        throw new CartNotFoundError(`Cart '${cartId}' not found in store '${storeId}'`);
      }
      this.assertCartOwnership(cart, caller);

      const variant = await this.repository.findVariant(tx, input.variantId);
      if (!variant) {
        throw new ProductVariantNotFoundError(
          `Product variant '${input.variantId}' not found`,
        );
      }
      if (variant.storeId !== storeId) {
        throw new CrossStoreVariantError(
          `Product variant '${input.variantId}' does not belong to store '${storeId}'`,
        );
      }
      if (variant.status !== "ACTIVE" || variant.productStatus !== "ACTIVE") {
        throw new ProductVariantUnavailableError(
          `Product variant '${input.variantId}' is unavailable for purchase`,
        );
      }
      if (variant.currency && variant.currency !== cart.currency) {
        if (cart.items.length === 0) {
          const storeCurrency =
            (await this.repository.findStoreCurrency(tx, storeId)) || cart.currency;
          if (variant.currency === storeCurrency) {
            cart.setCurrency(variant.currency);
            await this.repository.update(tx, cart);
          } else {
            throw new InvalidCurrencyError(
              `Product variant currency '${variant.currency}' does not match cart currency '${cart.currency}'`,
            );
          }
        } else {
          throw new InvalidCurrencyError(
            `Product variant currency '${variant.currency}' does not match cart currency '${cart.currency}'`,
          );
        }
      }

      // Check available inventory stock
      if (variant.availableQuantity <= 0) {
        throw new InsufficientCartStockError(
          `Product variant '${input.variantId}' is out of stock`,
          {
            variantId: input.variantId,
            availableQuantity: 0,
            requestedQuantity: input.quantity,
          },
        );
      }

      const existingItem = cart.getItem(input.variantId);
      const existingQuantity = existingItem?.quantity ?? 0;
      const targetQuantity = existingQuantity + input.quantity;

      if (targetQuantity > variant.availableQuantity) {
        throw new InsufficientCartStockError(
          `Requested total quantity of ${targetQuantity} exceeds available stock of ${variant.availableQuantity}`,
          {
            variantId: input.variantId,
            availableQuantity: variant.availableQuantity,
            requestedQuantity: targetQuantity,
          },
        );
      }

      // Check max order quantity limit
      if (variant.maxOrderQuantity !== null && targetQuantity > variant.maxOrderQuantity) {
        throw new CartItemQuantityExceedsLimitError(
          `Requested total quantity of ${targetQuantity} exceeds maximum order limit of ${variant.maxOrderQuantity}`,
          {
            variantId: input.variantId,
            maxOrderQuantity: variant.maxOrderQuantity,
            requestedQuantity: targetQuantity,
          },
        );
      }

      const item = cart.addItem({
        variantId: input.variantId,
        quantity: input.quantity,
        unitPrice: variant.price,
      });

      await this.repository.saveItem(tx, item);
      await this.repository.update(tx, cart);

      return toCartDTO(cart);
    });
  }

  async updateItemQuantity(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    cartId: string,
    variantIdOrItemId: string,
    input: UpdateCartItemQuantityInput | number,
    caller?: CartCallerContext,
  ): Promise<CartDTO> {
    const quantity = typeof input === "number" ? input : input.quantity;

    return runInTransaction(clientOrDb, async (tx) => {
      const cart = await this.repository.findWithItems(tx, storeId, cartId, true);
      if (!cart) {
        throw new CartNotFoundError(`Cart '${cartId}' not found in store '${storeId}'`);
      }
      this.assertCartOwnership(cart, caller);

      const existingItem =
        cart.getItem(variantIdOrItemId) ?? cart.getItemById(variantIdOrItemId);
      if (!existingItem) {
        throw new CartItemNotFoundError(
          `Cart item '${variantIdOrItemId}' not found in cart '${cartId}'`,
        );
      }

      const variantId = existingItem.variantId;

      if (quantity > 0) {
        const variant = await this.repository.findVariant(tx, variantId);
        if (variant) {
          if (variant.availableQuantity <= 0) {
            throw new InsufficientCartStockError(
              `Product variant '${variantId}' is out of stock`,
              {
                variantId,
                availableQuantity: 0,
                requestedQuantity: quantity,
              },
            );
          }
          if (quantity > variant.availableQuantity) {
            throw new InsufficientCartStockError(
              `Requested quantity of ${quantity} exceeds available stock of ${variant.availableQuantity}`,
              {
                variantId,
                availableQuantity: variant.availableQuantity,
                requestedQuantity: quantity,
              },
            );
          }
          if (variant.maxOrderQuantity !== null && quantity > variant.maxOrderQuantity) {
            throw new CartItemQuantityExceedsLimitError(
              `Requested quantity of ${quantity} exceeds maximum order limit of ${variant.maxOrderQuantity}`,
              {
                variantId,
                maxOrderQuantity: variant.maxOrderQuantity,
                requestedQuantity: quantity,
              },
            );
          }
        }
      }

      const updatedItem = cart.updateItemQuantity(variantId, quantity);

      if (updatedItem === null) {
        await this.repository.deleteItem(tx, storeId, cartId, variantId);
      } else {
        await this.repository.saveItem(tx, updatedItem);
      }

      await this.repository.update(tx, cart);
      return toCartDTO(cart);
    });
  }

  async removeItem(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    cartId: string,
    variantIdOrItemId: string,
    caller?: CartCallerContext,
  ): Promise<CartDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const cart = await this.repository.findWithItems(tx, storeId, cartId, true);
      if (!cart) {
        throw new CartNotFoundError(`Cart '${cartId}' not found in store '${storeId}'`);
      }
      this.assertCartOwnership(cart, caller);

      const existingItem =
        cart.getItem(variantIdOrItemId) ?? cart.getItemById(variantIdOrItemId);
      if (!existingItem) {
        throw new CartItemNotFoundError(
          `Cart item '${variantIdOrItemId}' not found in cart '${cartId}'`,
        );
      }

      const variantId = existingItem.variantId;
      cart.removeItem(variantId);

      await this.repository.deleteItem(tx, storeId, cartId, variantId);
      await this.repository.update(tx, cart);

      return toCartDTO(cart);
    });
  }

  async clearCart(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    cartId: string,
    caller?: CartCallerContext,
  ): Promise<CartDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const cart = await this.repository.findWithItems(tx, storeId, cartId, true);
      if (!cart) {
        throw new CartNotFoundError(`Cart '${cartId}' not found in store '${storeId}'`);
      }
      this.assertCartOwnership(cart, caller);

      cart.clear();

      await this.repository.clearItems(tx, storeId, cartId);
      await this.repository.update(tx, cart);

      return toCartDTO(cart);
    });
  }

  async updateTotals(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    cartId: string,
    totals: {
      discountTotal?: number;
      discountId?: string | null;
      discountCode?: string | null;
      taxTotal?: number;
      shippingTotal?: number;
    },
    caller?: CartCallerContext,
  ): Promise<CartDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const cart = await this.repository.findWithItems(tx, storeId, cartId, true);
      if (!cart) {
        throw new CartNotFoundError(`Cart '${cartId}' not found in store '${storeId}'`);
      }
      this.assertCartOwnership(cart, caller);

      cart.setTotals(totals);
      await this.repository.update(tx, cart);

      return toCartDTO(cart);
    });
  }

  async associateCustomer(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    cartId: string,
    customerId: string,
  ): Promise<CartDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const customer = await this.repository.findCustomer(tx, customerId);
      if (!customer) {
        throw new CustomerNotFoundError(`Customer '${customerId}' not found`);
      }
      if (customer.storeId !== storeId) {
        throw new CrossStoreCustomerError(
          `Customer '${customerId}' does not belong to store '${storeId}'`,
        );
      }

      const cart = await this.repository.findWithItems(tx, storeId, cartId, true);
      if (!cart) {
        throw new CartNotFoundError(`Cart '${cartId}' not found in store '${storeId}'`);
      }

      cart.assignCustomer(customerId);
      await this.repository.update(tx, cart);

      return toCartDTO(cart);
    });
  }

  async transitionCartStatus(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    cartId: string,
    newStatus: CartStatus,
  ): Promise<CartDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const cart = await this.repository.findWithItems(tx, storeId, cartId, true);
      if (!cart) {
        throw new CartNotFoundError(`Cart '${cartId}' not found in store '${storeId}'`);
      }

      cart.transitionTo(newStatus);
      await this.repository.update(tx, cart);

      return toCartDTO(cart);
    });
  }

  async getItem(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    cartId: string,
    variantIdOrItemId: string,
  ): Promise<CartItemDTO> {
    const cart = await this.repository.findById(clientOrDb, storeId, cartId);
    if (!cart) {
      throw new CartNotFoundError(`Cart '${cartId}' not found in store '${storeId}'`);
    }

    const item = await this.repository.getItem(
      clientOrDb,
      storeId,
      cartId,
      variantIdOrItemId,
    );
    if (!item) {
      throw new CartItemNotFoundError(
        `Cart item '${variantIdOrItemId}' not found in cart '${cartId}'`,
      );
    }

    return toCartItemDTO(item);
  }

  async listItems(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    cartId: string,
  ): Promise<CartItemDTO[]> {
    const cart = await this.repository.findById(clientOrDb, storeId, cartId);
    if (!cart) {
      throw new CartNotFoundError(`Cart '${cartId}' not found in store '${storeId}'`);
    }

    const items = await this.repository.listItems(clientOrDb, storeId, cartId);
    return items.map(toCartItemDTO);
  }
}
