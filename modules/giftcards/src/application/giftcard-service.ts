import {
  generateUuidV7,
  NotificationOutboxRepository,
  type Database,
  type DatabaseClient,
} from "@calcart/db";
import {
  generateGiftCardCode,
  hashGiftCardCode,
  maskGiftCardCode,
  normalizeGiftCardCode,
} from "../domain/gift-card-code.js";
import {
  GiftCardCurrencyMismatchError,
  GiftCardDepletedError,
  GiftCardDisabledError,
  GiftCardExpiredError,
  GiftCardNotFoundError,
  InsufficientGiftCardBalanceError,
  InsufficientStoreCreditBalanceError,
  StoreCreditNotFoundError,
} from "../domain/giftcard-errors.js";
import {
  GiftCardRepository,
  type CheckoutGiftCardRow,
  type CheckoutStoreCreditRow,
  type GiftCardRow,
  type GiftCardTransactionRow,
  type OrderGiftCardRow,
  type OrderStoreCreditRow,
  type StoreCreditRow,
  type StoreCreditTransactionRow,
} from "../infrastructure/giftcard-repository.js";
import type {
  AppliedGiftCardDTO,
  AppliedStoreCreditDTO,
  ApplyGiftCardToCheckoutInput,
  ApplyStoreCreditToCheckoutInput,
  CreateGiftCardInput,
  GiftCardDTO,
  GiftCardTransactionDTO,
  IssueStoreCreditInput,
  OrderGiftCardDTO,
  OrderStoreCreditDTO,
  RedeemGiftCardInput,
  RedeemStoreCreditInput,
  RefundToGiftCardInput,
  StoreCreditDTO,
  StoreCreditTransactionDTO,
} from "./dtos.js";

type Client = Database | DatabaseClient;

function toNumber(val: string | number | bigint | null | undefined): number {
  return val === null || val === undefined ? 0 : Number(val);
}

function toGiftCardDTO(row: GiftCardRow): GiftCardDTO {
  return {
    id: row.id,
    storeId: row.store_id,
    code: row.code,
    maskedCode: maskGiftCardCode(row.code),
    initialBalance: toNumber(row.initial_balance),
    currentBalance: toNumber(row.current_balance),
    currency: row.currency,
    status: row.status,
    customerId: row.customer_id,
    recipientEmail: row.recipient_email,
    recipientName: row.recipient_name,
    message: row.message,
    expiresAt: row.expires_at ? row.expires_at.toISOString() : null,
    disabledAt: row.disabled_at ? row.disabled_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toGiftCardTransactionDTO(row: GiftCardTransactionRow): GiftCardTransactionDTO {
  return {
    id: row.id,
    storeId: row.store_id,
    giftCardId: row.gift_card_id,
    type: row.type,
    amount: toNumber(row.amount),
    balanceBefore: toNumber(row.balance_before),
    balanceAfter: toNumber(row.balance_after),
    checkoutId: row.checkout_id,
    orderId: row.order_id,
    idempotencyKey: row.idempotency_key,
    notes: row.notes,
    createdAt: row.created_at.toISOString(),
  };
}

function toStoreCreditDTO(row: StoreCreditRow): StoreCreditDTO {
  return {
    id: row.id,
    storeId: row.store_id,
    customerId: row.customer_id,
    currency: row.currency,
    currentBalance: toNumber(row.current_balance),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toStoreCreditTransactionDTO(row: StoreCreditTransactionRow): StoreCreditTransactionDTO {
  return {
    id: row.id,
    storeId: row.store_id,
    storeCreditId: row.store_credit_id,
    customerId: row.customer_id,
    type: row.type,
    amount: toNumber(row.amount),
    balanceBefore: toNumber(row.balance_before),
    balanceAfter: toNumber(row.balance_after),
    orderId: row.order_id,
    checkoutId: row.checkout_id,
    idempotencyKey: row.idempotency_key,
    notes: row.notes,
    createdAt: row.created_at.toISOString(),
  };
}

function toAppliedGiftCardDTO(row: CheckoutGiftCardRow): AppliedGiftCardDTO {
  const code = row.code || "";
  const codeLast4 = code.replace(/-/g, "").slice(-4) || "XXXX";
  return {
    id: row.id,
    storeId: row.store_id,
    checkoutId: row.checkout_id,
    giftCardId: row.gift_card_id,
    codeLast4,
    maskedCode: maskGiftCardCode(code),
    appliedAmount: toNumber(row.applied_amount),
    currentBalance: toNumber(row.current_balance),
    currency: row.currency || "INR",
  };
}

function toOrderGiftCardDTO(row: OrderGiftCardRow): OrderGiftCardDTO {
  return {
    id: row.id,
    storeId: row.store_id,
    orderId: row.order_id,
    giftCardId: row.gift_card_id,
    codeLast4: row.code_last4,
    amount: toNumber(row.amount),
    createdAt: row.created_at.toISOString(),
  };
}

function toAppliedStoreCreditDTO(row: CheckoutStoreCreditRow): AppliedStoreCreditDTO {
  return {
    id: row.id,
    storeId: row.store_id,
    checkoutId: row.checkout_id,
    storeCreditId: row.store_credit_id,
    customerId: row.customer_id,
    appliedAmount: toNumber(row.applied_amount),
    currentBalance: toNumber(row.current_balance),
    currency: row.currency || "INR",
  };
}

function toOrderStoreCreditDTO(row: OrderStoreCreditRow): OrderStoreCreditDTO {
  return {
    id: row.id,
    storeId: row.store_id,
    orderId: row.order_id,
    storeCreditId: row.store_credit_id,
    customerId: row.customer_id,
    amount: toNumber(row.amount),
    createdAt: row.created_at.toISOString(),
  };
}

export class GiftCardService {
  constructor(
    private readonly repo: GiftCardRepository = new GiftCardRepository(),
    private readonly outboxRepo: NotificationOutboxRepository = new NotificationOutboxRepository(),
  ) {}

  // -------------------------------------------------------------------------
  // Gift Card Management & Queries
  // -------------------------------------------------------------------------

  async createGiftCard(
    client: Client,
    storeId: string,
    input: CreateGiftCardInput,
  ): Promise<GiftCardDTO> {
    if (!input.initialBalance || input.initialBalance <= 0) {
      throw new TypeError("Initial gift card balance must be a positive integer");
    }

    const code = input.code ? normalizeGiftCardCode(input.code) : generateGiftCardCode();
    const codeHash = hashGiftCardCode(code);
    const currency = (input.currency || "INR").toUpperCase();
    const id = generateUuidV7();

    const row = await this.repo.insertGiftCard(client, {
      id,
      storeId,
      code,
      codeHash,
      initialBalance: input.initialBalance,
      currentBalance: input.initialBalance,
      currency,
      status: "ACTIVE",
      customerId: input.customerId,
      recipientEmail: input.recipientEmail,
      recipientName: input.recipientName,
      message: input.message,
      expiresAt: input.expiresAt,
    });

    // Record initial issuance in immutable ledger
    await this.repo.insertGiftCardTransaction(client, {
      id: generateUuidV7(),
      storeId,
      giftCardId: id,
      type: "ISSUANCE",
      amount: input.initialBalance,
      balanceBefore: 0,
      balanceAfter: input.initialBalance,
      idempotencyKey: `issuance:${id}`,
      notes: input.notes || "Initial gift card issuance",
    });

    if (input.recipientEmail) {
      let storeName = "Our Store";
      let storeSlug = "";
      try {
        const storeRes = await client.query<{ name: string; slug: string }>(
          `SELECT name, slug FROM stores WHERE id = $1`,
          [storeId],
        );
        const store = storeRes.rows[0];
        if (store) {
          storeName = store.name;
          storeSlug = store.slug;
        }
      } catch {
        // Fallback gracefully if store lookup fails
      }

      await this.outboxRepo.create(client, {
        storeId,
        notificationType: "GIFT_CARD_DELIVERY",
        recipientEmail: input.recipientEmail,
        referenceType: "GIFT_CARD",
        referenceId: id,
        idempotencyKey: `giftcard:delivery:${id}`,
        payload: {
          storeName,
          storeSlug,
          code,
          initialBalance: input.initialBalance,
          currency,
          recipientName: input.recipientName,
          message: input.message,
          expiresAt: input.expiresAt ? input.expiresAt.toISOString() : null,
          storeUrl: storeSlug ? `https://${storeSlug}.calcart.com` : undefined,
        },
      });
    }

    return toGiftCardDTO(row);
  }

  async getGiftCardById(client: Client, storeId: string, id: string): Promise<GiftCardDTO> {
    const row = await this.repo.findGiftCardById(client, storeId, id);
    if (!row) throw new GiftCardNotFoundError();
    return toGiftCardDTO(row);
  }

  async getGiftCardByCode(client: Client, storeId: string, code: string): Promise<GiftCardDTO> {
    const codeHash = hashGiftCardCode(code);
    const row = await this.repo.findGiftCardByCodeHash(client, storeId, codeHash);
    if (!row) throw new GiftCardNotFoundError();
    return toGiftCardDTO(row);
  }

  async lookupGiftCard(
    client: Client,
    storeId: string,
    code: string,
  ): Promise<{
    id: string;
    maskedCode: string;
    currentBalance: number;
    currency: string;
    status: string;
    isUsable: boolean;
    expiresAt: string | null;
  }> {
    const codeHash = hashGiftCardCode(code);
    const row = await this.repo.findGiftCardByCodeHash(client, storeId, codeHash);
    if (!row) throw new GiftCardNotFoundError();

    const isExpired = row.expires_at ? new Date() > row.expires_at : false;
    const balance = toNumber(row.current_balance);
    const isUsable = row.status === "ACTIVE" && !isExpired && balance > 0;

    return {
      id: row.id,
      maskedCode: maskGiftCardCode(row.code),
      currentBalance: balance,
      currency: row.currency,
      status: isExpired ? "EXPIRED" : row.status,
      isUsable,
      expiresAt: row.expires_at ? row.expires_at.toISOString() : null,
    };
  }

  async disableGiftCard(client: Client, storeId: string, id: string): Promise<GiftCardDTO> {
    const row = await this.repo.disableGiftCard(client, storeId, id);
    if (!row) throw new GiftCardNotFoundError();
    return toGiftCardDTO(row);
  }

  async listGiftCards(
    client: Client,
    storeId: string,
    options?: { status?: "ACTIVE" | "DISABLED" | "DEPLETED" | "EXPIRED"; limit?: number; offset?: number },
  ): Promise<GiftCardDTO[]> {
    const rows = await this.repo.listGiftCards(client, storeId, options);
    return rows.map(toGiftCardDTO);
  }

  async listGiftCardTransactions(
    client: Client,
    storeId: string,
    giftCardId: string,
  ): Promise<GiftCardTransactionDTO[]> {
    const rows = await this.repo.listGiftCardTransactions(client, storeId, giftCardId);
    return rows.map(toGiftCardTransactionDTO);
  }

  // -------------------------------------------------------------------------
  // Gift Card Redemption & Refund (Atomic Ledger)
  // -------------------------------------------------------------------------

  /**
   * Concurrency-safe atomic redemption of a gift card balance.
   * Locks the row FOR UPDATE, enforces balance invariants, and logs immutable ledger entry.
   */
  async redeemGiftCard(
    client: Client,
    storeId: string,
    giftCardId: string,
    input: RedeemGiftCardInput,
  ): Promise<{ giftCard: GiftCardDTO; transaction: GiftCardTransactionDTO }> {
    if (!input.amount || input.amount <= 0) {
      throw new TypeError("Redemption amount must be greater than zero");
    }

    // 1. Idempotency Check
    const existingTx = await this.repo.findGiftCardTransactionByIdempotencyKey(
      client,
      storeId,
      giftCardId,
      input.idempotencyKey,
    );
    if (existingTx) {
      const card = await this.repo.findGiftCardById(client, storeId, giftCardId);
      if (!card) throw new GiftCardNotFoundError();
      return {
        giftCard: toGiftCardDTO(card),
        transaction: toGiftCardTransactionDTO(existingTx),
      };
    }

    // 2. Fetch Card with exclusive lock
    const card = await this.repo.findGiftCardById(client, storeId, giftCardId, true);
    if (!card) throw new GiftCardNotFoundError();

    if (card.status === "DISABLED") throw new GiftCardDisabledError();
    if (card.status === "DEPLETED" || toNumber(card.current_balance) === 0) {
      throw new GiftCardDepletedError();
    }
    if (card.expires_at && new Date() > card.expires_at) {
      throw new GiftCardExpiredError();
    }
    if (card.currency.toUpperCase() !== input.currency.toUpperCase()) {
      throw new GiftCardCurrencyMismatchError(card.currency, input.currency);
    }

    const currentBal = toNumber(card.current_balance);
    if (currentBal < input.amount) {
      throw new InsufficientGiftCardBalanceError(currentBal, input.amount);
    }

    const newBalance = currentBal - input.amount;
    const nextStatus = newBalance === 0 ? "DEPLETED" : "ACTIVE";

    // 3. Update Balance
    const updatedCard = await this.repo.updateGiftCardBalance(
      client,
      storeId,
      giftCardId,
      newBalance,
      nextStatus,
    );
    if (!updatedCard) throw new GiftCardNotFoundError();

    // 4. Record Ledger Entry
    const tx = await this.repo.insertGiftCardTransaction(client, {
      id: generateUuidV7(),
      storeId,
      giftCardId,
      type: "REDEMPTION",
      amount: -input.amount,
      balanceBefore: currentBal,
      balanceAfter: newBalance,
      checkoutId: input.checkoutId,
      orderId: input.orderId,
      idempotencyKey: input.idempotencyKey,
      notes: input.notes || "Checkout redemption",
    });

    return {
      giftCard: toGiftCardDTO(updatedCard),
      transaction: toGiftCardTransactionDTO(tx),
    };
  }

  /**
   * Credits a previously redeemed amount back to the gift card (e.g. order cancellation or return).
   */
  async refundToGiftCard(
    client: Client,
    storeId: string,
    giftCardId: string,
    input: RefundToGiftCardInput,
  ): Promise<{ giftCard: GiftCardDTO; transaction: GiftCardTransactionDTO }> {
    if (!input.amount || input.amount <= 0) {
      throw new TypeError("Refund amount must be greater than zero");
    }

    // 1. Idempotency Check
    const existingTx = await this.repo.findGiftCardTransactionByIdempotencyKey(
      client,
      storeId,
      giftCardId,
      input.idempotencyKey,
    );
    if (existingTx) {
      const card = await this.repo.findGiftCardById(client, storeId, giftCardId);
      if (!card) throw new GiftCardNotFoundError();
      return {
        giftCard: toGiftCardDTO(card),
        transaction: toGiftCardTransactionDTO(existingTx),
      };
    }

    // 2. Fetch Card with exclusive lock
    const card = await this.repo.findGiftCardById(client, storeId, giftCardId, true);
    if (!card) throw new GiftCardNotFoundError();

    if (card.status === "DISABLED") throw new GiftCardDisabledError();
    if (card.currency.toUpperCase() !== input.currency.toUpperCase()) {
      throw new GiftCardCurrencyMismatchError(card.currency, input.currency);
    }

    const currentBal = toNumber(card.current_balance);
    const newBalance = currentBal + input.amount;
    const nextStatus = "ACTIVE"; // restores from DEPLETED if balance is replenished

    // 3. Update Balance
    const updatedCard = await this.repo.updateGiftCardBalance(
      client,
      storeId,
      giftCardId,
      newBalance,
      nextStatus,
    );
    if (!updatedCard) throw new GiftCardNotFoundError();

    // 4. Record Ledger Entry
    const tx = await this.repo.insertGiftCardTransaction(client, {
      id: generateUuidV7(),
      storeId,
      giftCardId,
      type: "REFUND",
      amount: input.amount,
      balanceBefore: currentBal,
      balanceAfter: newBalance,
      orderId: input.orderId,
      idempotencyKey: input.idempotencyKey,
      notes: input.notes || "Refund adjustment to gift card",
    });

    return {
      giftCard: toGiftCardDTO(updatedCard),
      transaction: toGiftCardTransactionDTO(tx),
    };
  }

  // -------------------------------------------------------------------------
  // Customer Store Credit Management & Ledger
  // -------------------------------------------------------------------------

  async getOrCreateStoreCredit(
    client: Client,
    storeId: string,
    customerId: string,
    currency = "INR",
  ): Promise<StoreCreditDTO> {
    const existing = await this.repo.findStoreCredit(client, storeId, customerId, currency);
    if (existing) return toStoreCreditDTO(existing);

    const created = await this.repo.insertStoreCredit(client, {
      id: generateUuidV7(),
      storeId,
      customerId,
      currency,
      currentBalance: 0,
    });
    return toStoreCreditDTO(created);
  }

  async issueStoreCredit(
    client: Client,
    storeId: string,
    customerId: string,
    input: IssueStoreCreditInput,
  ): Promise<{ storeCredit: StoreCreditDTO; transaction: StoreCreditTransactionDTO }> {
    if (!input.amount || input.amount <= 0) {
      throw new TypeError("Store credit amount must be greater than zero");
    }

    const currency = (input.currency || "INR").toUpperCase();
    const account = await this.getOrCreateStoreCredit(client, storeId, customerId, currency);

    // 1. Idempotency Check
    const existingTx = await this.repo.findStoreCreditTransactionByIdempotencyKey(
      client,
      storeId,
      account.id,
      input.idempotencyKey,
    );
    if (existingTx) {
      const current = await this.repo.findStoreCredit(client, storeId, customerId, currency);
      if (!current) throw new StoreCreditNotFoundError();
      return {
        storeCredit: toStoreCreditDTO(current),
        transaction: toStoreCreditTransactionDTO(existingTx),
      };
    }

    // 2. Fetch Account with lock
    const locked = await this.repo.findStoreCredit(client, storeId, customerId, currency, true);
    if (!locked) throw new StoreCreditNotFoundError();

    const currentBal = toNumber(locked.current_balance);
    const newBal = currentBal + input.amount;

    // 3. Update Balance
    const updated = await this.repo.updateStoreCreditBalance(client, storeId, locked.id, newBal);
    if (!updated) throw new StoreCreditNotFoundError();

    // 4. Record Ledger Entry
    const tx = await this.repo.insertStoreCreditTransaction(client, {
      id: generateUuidV7(),
      storeId,
      storeCreditId: locked.id,
      customerId,
      type: input.orderId ? "REFUND" : "ISSUANCE",
      amount: input.amount,
      balanceBefore: currentBal,
      balanceAfter: newBal,
      orderId: input.orderId,
      idempotencyKey: input.idempotencyKey,
      notes: input.notes || "Store credit issuance",
    });

    return {
      storeCredit: toStoreCreditDTO(updated),
      transaction: toStoreCreditTransactionDTO(tx),
    };
  }

  async redeemStoreCredit(
    client: Client,
    storeId: string,
    customerId: string,
    input: RedeemStoreCreditInput,
  ): Promise<{ storeCredit: StoreCreditDTO; transaction: StoreCreditTransactionDTO }> {
    if (!input.amount || input.amount <= 0) {
      throw new TypeError("Redemption amount must be greater than zero");
    }

    const currency = (input.currency || "INR").toUpperCase();
    const account = await this.repo.findStoreCredit(client, storeId, customerId, currency, true);
    if (!account) throw new StoreCreditNotFoundError();

    // 1. Idempotency Check
    const existingTx = await this.repo.findStoreCreditTransactionByIdempotencyKey(
      client,
      storeId,
      account.id,
      input.idempotencyKey,
    );
    if (existingTx) {
      const current = await this.repo.findStoreCredit(client, storeId, customerId, currency);
      if (!current) throw new StoreCreditNotFoundError();
      return {
        storeCredit: toStoreCreditDTO(current),
        transaction: toStoreCreditTransactionDTO(existingTx),
      };
    }

    const currentBal = toNumber(account.current_balance);
    if (currentBal < input.amount) {
      throw new InsufficientStoreCreditBalanceError(currentBal, input.amount);
    }

    const newBal = currentBal - input.amount;

    // 2. Update Balance
    const updated = await this.repo.updateStoreCreditBalance(client, storeId, account.id, newBal);
    if (!updated) throw new StoreCreditNotFoundError();

    // 3. Record Ledger Entry
    const tx = await this.repo.insertStoreCreditTransaction(client, {
      id: generateUuidV7(),
      storeId,
      storeCreditId: account.id,
      customerId,
      type: "REDEMPTION",
      amount: -input.amount,
      balanceBefore: currentBal,
      balanceAfter: newBal,
      orderId: input.orderId,
      checkoutId: input.checkoutId,
      idempotencyKey: input.idempotencyKey,
      notes: input.notes || "Store credit checkout redemption",
    });

    return {
      storeCredit: toStoreCreditDTO(updated),
      transaction: toStoreCreditTransactionDTO(tx),
    };
  }

  async listStoreCreditTransactions(
    client: Client,
    storeId: string,
    storeCreditId: string,
  ): Promise<StoreCreditTransactionDTO[]> {
    const rows = await this.repo.listStoreCreditTransactions(client, storeId, storeCreditId);
    return rows.map(toStoreCreditTransactionDTO);
  }

  // -------------------------------------------------------------------------
  // Checkout & Order Gift Card Orchestration
  // -------------------------------------------------------------------------

  async getCheckoutGiftCards(
    client: Client,
    storeId: string,
    checkoutId: string,
  ): Promise<AppliedGiftCardDTO[]> {
    const rows = await this.repo.findCheckoutGiftCards(client, storeId, checkoutId);
    return rows.map(toAppliedGiftCardDTO);
  }

  async applyGiftCardToCheckout(
    client: Client,
    input: ApplyGiftCardToCheckoutInput,
  ): Promise<{
    appliedCard: AppliedGiftCardDTO;
    giftCardTotal: number;
    remainingTotal: number;
  }> {
    const { storeId, checkoutId, code, grossTotal, currency } = input;
    const normalizedCode = normalizeGiftCardCode(code);
    const codeHash = hashGiftCardCode(normalizedCode);

    const card = await this.repo.findGiftCardByCodeHash(client, storeId, codeHash);
    if (!card) {
      throw new GiftCardNotFoundError("Gift card not found");
    }

    if (card.status === "DISABLED") {
      throw new GiftCardDisabledError("Gift card has been disabled");
    }
    const currentBalance = toNumber(card.current_balance);
    if (card.status === "DEPLETED" || currentBalance <= 0) {
      throw new GiftCardDepletedError("Gift card balance is depleted");
    }
    if (card.expires_at && new Date() > card.expires_at) {
      throw new GiftCardExpiredError("Gift card has expired");
    }
    if (card.currency.toUpperCase() !== currency.toUpperCase()) {
      throw new GiftCardCurrencyMismatchError(card.currency, currency);
    }

    // Existing cards on checkout
    const existingCards = await this.repo.findCheckoutGiftCards(client, storeId, checkoutId);
    const otherCardsTotal = existingCards
      .filter((c) => c.gift_card_id !== card.id)
      .reduce((sum, c) => sum + toNumber(c.applied_amount), 0);

    const remainingGross = Math.max(0, grossTotal - otherCardsTotal);
    if (remainingGross <= 0) {
      throw new TypeError("Checkout total is already fully covered by applied gift cards");
    }

    const appliedAmount = Math.min(currentBalance, remainingGross);
    const appliedRow = await this.repo.insertCheckoutGiftCard(client, {
      id: generateUuidV7(),
      storeId,
      checkoutId,
      giftCardId: card.id,
      appliedAmount,
    });

    const newGiftCardTotal = otherCardsTotal + appliedAmount;
    const remainingTotal = Math.max(0, grossTotal - newGiftCardTotal);

    const completeRow: CheckoutGiftCardRow = {
      ...appliedRow,
      code: card.code,
      currency: card.currency,
      current_balance: card.current_balance,
      status: card.status,
    };

    return {
      appliedCard: toAppliedGiftCardDTO(completeRow),
      giftCardTotal: newGiftCardTotal,
      remainingTotal,
    };
  }

  async removeGiftCardFromCheckout(
    client: Client,
    storeId: string,
    checkoutId: string,
    giftCardId: string,
  ): Promise<void> {
    await this.repo.deleteCheckoutGiftCard(client, storeId, checkoutId, giftCardId);
  }

  async redeemCheckoutGiftCardsForOrder(
    client: Client,
    input: {
      storeId: string;
      checkoutId: string;
      orderId: string;
      currency: string;
      maxAmountToRedeem?: number;
    },
  ): Promise<{ totalRedeemed: number; orderGiftCards: OrderGiftCardDTO[] }> {
    const { storeId, checkoutId, orderId, currency, maxAmountToRedeem } = input;
    const appliedCards = await this.repo.findCheckoutGiftCards(client, storeId, checkoutId);

    const orderGiftCards: OrderGiftCardDTO[] = [];
    let totalRedeemed = 0;
    let remainingPayable =
      maxAmountToRedeem !== undefined ? Math.max(0, maxAmountToRedeem) : Infinity;

    for (const applied of appliedCards) {
      if (remainingPayable <= 0) {
        break;
      }

      const configuredAmount = toNumber(applied.applied_amount);
      if (configuredAmount <= 0) continue;

      const amountToRedeem = Math.min(configuredAmount, remainingPayable);
      if (amountToRedeem <= 0) continue;

      const card = await this.repo.findGiftCardById(client, storeId, applied.gift_card_id, true);
      if (!card) {
        throw new GiftCardNotFoundError(`Applied gift card ${applied.gift_card_id} not found`);
      }

      await this.redeemGiftCard(client, storeId, applied.gift_card_id, {
        amount: amountToRedeem,
        currency,
        orderId,
        checkoutId,
        idempotencyKey: `order-giftcard:${orderId}:${applied.gift_card_id}`,
        notes: `Redemption for Order ${orderId}`,
      });

      const code = applied.code || card.code;
      const codeLast4 = code.replace(/-/g, "").slice(-4) || "XXXX";

      const orderCardRow = await this.repo.insertOrderGiftCard(client, {
        id: generateUuidV7(),
        storeId,
        orderId,
        giftCardId: applied.gift_card_id,
        codeLast4,
        amount: amountToRedeem,
      });

      if (orderCardRow) {
        orderGiftCards.push(toOrderGiftCardDTO(orderCardRow));
      }
      totalRedeemed += amountToRedeem;
      remainingPayable -= amountToRedeem;
    }

    // Clean up applied checkout records
    await this.repo.deleteCheckoutGiftCardsForCheckout(client, storeId, checkoutId);

    return { totalRedeemed, orderGiftCards };
  }

  async listOrderGiftCards(
    client: Client,
    storeId: string,
    orderId: string,
  ): Promise<OrderGiftCardDTO[]> {
    const rows = await this.repo.listOrderGiftCards(client, storeId, orderId);
    return rows.map(toOrderGiftCardDTO);
  }

  // -------------------------------------------------------------------------
  // Checkout Store Credit Operations
  // -------------------------------------------------------------------------

  async getCheckoutStoreCredit(
    client: Client,
    storeId: string,
    checkoutId: string,
  ): Promise<AppliedStoreCreditDTO | null> {
    const row = await this.repo.findCheckoutStoreCredit(client, storeId, checkoutId);
    return row ? toAppliedStoreCreditDTO(row) : null;
  }

  async applyStoreCreditToCheckout(
    client: Client,
    input: ApplyStoreCreditToCheckoutInput,
  ): Promise<{
    appliedStoreCredit: AppliedStoreCreditDTO;
    remainingTotal: number;
  }> {
    const { storeId, checkoutId, customerId, grossTotal, currency, requestedAmount } = input;
    const account = await this.repo.findStoreCredit(client, storeId, customerId, currency, true);
    if (!account) {
      throw new StoreCreditNotFoundError("Store credit account not found for this customer");
    }

    const currentBalance = toNumber(account.current_balance);
    if (currentBalance <= 0) {
      throw new InsufficientStoreCreditBalanceError(0, 1);
    }

    if (grossTotal <= 0) {
      throw new TypeError("Checkout total is already fully covered");
    }

    const desiredAmount =
      requestedAmount !== undefined
        ? Math.min(requestedAmount, currentBalance, grossTotal)
        : Math.min(currentBalance, grossTotal);

    if (desiredAmount <= 0) {
      throw new TypeError("Applied store credit amount must be greater than zero");
    }

    const row = await this.repo.insertCheckoutStoreCredit(client, {
      id: generateUuidV7(),
      storeId,
      checkoutId,
      storeCreditId: account.id,
      customerId,
      appliedAmount: desiredAmount,
    });

    const completeRow: CheckoutStoreCreditRow = {
      ...row,
      currency: account.currency,
      current_balance: account.current_balance,
    };

    const remainingTotal = Math.max(0, grossTotal - desiredAmount);

    return {
      appliedStoreCredit: toAppliedStoreCreditDTO(completeRow),
      remainingTotal,
    };
  }

  async removeStoreCreditFromCheckout(
    client: Client,
    storeId: string,
    checkoutId: string,
  ): Promise<void> {
    await this.repo.deleteCheckoutStoreCredit(client, storeId, checkoutId);
  }

  async redeemCheckoutStoreCreditForOrder(
    client: Client,
    input: {
      storeId: string;
      checkoutId: string;
      orderId: string;
      currency: string;
      maxAmountToRedeem?: number;
    },
  ): Promise<{ totalRedeemed: number; orderStoreCredit: OrderStoreCreditDTO | null }> {
    const { storeId, checkoutId, orderId, currency, maxAmountToRedeem } = input;
    const applied = await this.repo.findCheckoutStoreCredit(client, storeId, checkoutId);
    if (!applied) {
      return { totalRedeemed: 0, orderStoreCredit: null };
    }

    const appliedAmount = toNumber(applied.applied_amount);
    const amountToRedeem =
      maxAmountToRedeem !== undefined
        ? Math.min(appliedAmount, Math.max(0, maxAmountToRedeem))
        : appliedAmount;

    if (amountToRedeem <= 0) {
      await this.repo.deleteCheckoutStoreCredit(client, storeId, checkoutId);
      return { totalRedeemed: 0, orderStoreCredit: null };
    }

    await this.redeemStoreCredit(client, storeId, applied.customer_id, {
      amount: amountToRedeem,
      currency,
      orderId,
      checkoutId,
      idempotencyKey: `order-storecredit:${orderId}:${applied.store_credit_id}`,
      notes: `Checkout redemption for order ${orderId}`,
    });

    const orderRow = await this.repo.insertOrderStoreCredit(client, {
      id: generateUuidV7(),
      storeId,
      orderId,
      storeCreditId: applied.store_credit_id,
      customerId: applied.customer_id,
      amount: amountToRedeem,
    });

    await this.repo.deleteCheckoutStoreCredit(client, storeId, checkoutId);

    return {
      totalRedeemed: amountToRedeem,
      orderStoreCredit: orderRow ? toOrderStoreCreditDTO(orderRow) : null,
    };
  }
}
