import {
  type Database,
  type DatabaseClient,
  generateUuidV7,
  OrderRepository,
  PaymentRepository,
  type PaymentRow,
} from "@calcart/db";
import {
  NotificationOutboxService,
  OrderService,
  OrderStatusService,
  type OrderDTO,
  type TrustedCheckoutData,
} from "@calcart/orders";
import { DiscountRedemptionService } from "@calcart/discounts";
import {
  TaxService,
  allocateByWeight,
  buildIssueInvoiceInput,
} from "@calcart/tax";
import {
  CheckoutRepository,
  CheckoutService,
  toCheckoutDTO,
  type CheckoutAddressDTO,
  type CheckoutDTO,
} from "@calcart/checkout";
import { CustomerService } from "@calcart/customers";
import { GiftCardService } from "@calcart/giftcards";
import { globalEventBus } from "@calcart/event-bus";
import {
  CrossStorePaymentAccessError,
  PaymentNotFoundError,
  PaymentValidationError,
  PurchaseWorkflowBlockedError,
} from "../domain/payment-errors.js";
import { toPaymentDTO, type PaymentDTO } from "./dtos.js";
import { runInTransaction } from "./payment-service.js";

export interface CompletePurchaseWorkflowInput {
  storeId: string;
  paymentId: string;
}

export interface PurchaseWorkflowResult {
  payment: PaymentDTO;
  order: OrderDTO;
  checkout: CheckoutDTO;
  orderCreated: boolean;
}

export class PaymentOrderIntegration {
  constructor(
    private readonly paymentRepo: PaymentRepository = new PaymentRepository(),
    private readonly orderRepo: OrderRepository = new OrderRepository(),
    private readonly checkoutRepo: CheckoutRepository = new CheckoutRepository(),
    private readonly orderService: OrderService = new OrderService(),
    private readonly orderStatusService: OrderStatusService = new OrderStatusService(),
    private readonly checkoutService: CheckoutService = new CheckoutService(),
    private readonly notificationOutboxService: NotificationOutboxService = new NotificationOutboxService(),
    private readonly discountRedemptionService: DiscountRedemptionService = new DiscountRedemptionService(),
    private readonly taxService: TaxService = new TaxService(),
    private readonly customerService: CustomerService = new CustomerService(),
    private readonly giftCardService: GiftCardService = new GiftCardService(),
  ) {}

  /**
   * Finalizes the captured purchase workflow:
   * 1. Verifies that the payment is in CAPTURED status and matches the store context.
   * 2. Idempotently creates the Order from the trusted checkout snapshot using OrderService.
   * 3. Updates the order payment status to PAID with internal authorization.
   * 4. Links the payment to the order and the order to the payment.
   * 5. Finalizes the checkout transition to COMPLETED.
   * 6. Safe against duplicate executions, concurrent racing webhooks/callbacks, and network retries.
   */
  async completePurchaseWorkflow(
    clientOrDb: Database | DatabaseClient,
    input: CompletePurchaseWorkflowInput,
  ): Promise<PurchaseWorkflowResult> {
    const { storeId, paymentId } = input;

    const finish = async (result: PurchaseWorkflowResult): Promise<PurchaseWorkflowResult> => {
      await this.rememberCheckoutAddresses(clientOrDb, result.checkout);
      if (result.orderCreated) {
        void globalEventBus.publish({
          eventId: generateUuidV7(),
          eventType: "order.created",
          occurredAt: new Date(),
          payload: {
            storeId,
            orderId: result.order.id,
            orderNumber: result.order.orderNumber,
            customerId: result.order.customerId,
            total: Number(result.order.total),
            currency: result.order.currency,
          },
        });
        void globalEventBus.publish({
          eventId: generateUuidV7(),
          eventType: "order.paid",
          occurredAt: new Date(),
          payload: {
            storeId,
            orderId: result.order.id,
            orderNumber: result.order.orderNumber,
            paymentId: result.payment.id,
            amount: Number(result.payment.amount),
            currency: result.payment.currency,
          },
        });
      }
      return result;
    };

    // 1. Load and Validate Payment
    const paymentRow = await this.paymentRepo.findById(clientOrDb, storeId, paymentId);
    if (!paymentRow) {
      const anyStore = await clientOrDb.query<{ store_id: string }>(
        `SELECT store_id FROM payments WHERE id = $1`,
        [paymentId],
      );
      if (anyStore.rows.length > 0 && anyStore.rows[0]?.store_id !== storeId) {
        throw new CrossStorePaymentAccessError(
          `Payment '${paymentId}' does not belong to store '${storeId}'`,
        );
      }
      throw new PaymentNotFoundError(`Payment '${paymentId}' not found in store '${storeId}'`);
    }

    if (paymentRow.status !== "CAPTURED") {
      throw new PaymentValidationError(
        `Payment '${paymentId}' is in status '${paymentRow.status}'. Order creation requires CAPTURED status.`,
      );
    }

    // 2. Fast Path: If Payment is already linked to an Order
    if (paymentRow.order_id) {
      const order = await this.orderService.getOrderById(clientOrDb, storeId, paymentRow.order_id);
      if (!order) {
        throw new PaymentValidationError(
          `Linked order '${paymentRow.order_id}' not found for payment '${paymentId}'`,
        );
      }

      const checkoutEntity = await this.checkoutRepo.findWithItems(
        clientOrDb,
        storeId,
        paymentRow.checkout_id,
      );

      let checkoutDto: CheckoutDTO;
      if (checkoutEntity && checkoutEntity.status !== "COMPLETED") {
        checkoutDto = await this.checkoutService.completeCheckout(
          clientOrDb,
          storeId,
          paymentRow.checkout_id,
        );
      } else if (checkoutEntity) {
        checkoutDto = toCheckoutDTO(checkoutEntity);
      } else {
        throw new PurchaseWorkflowBlockedError(
          `Checkout '${paymentRow.checkout_id}' not found`,
        );
      }

      return finish({
        payment: toPaymentDTO(paymentRow),
        order,
        checkout: checkoutDto,
        orderCreated: false,
      });
    }

    // 3. Check if an Order was already created for this (store_id, checkout_id)
    const existingOrderRow = await this.orderRepo.findByCheckoutId(
      clientOrDb,
      storeId,
      paymentRow.checkout_id,
    );

    if (existingOrderRow) {
      // Link payment to this existing order
      const updatedPaymentRow = await this.paymentRepo.updateStatus(
        clientOrDb,
        storeId,
        paymentRow.id,
        paymentRow.status,
        { orderId: existingOrderRow.id },
      );

      // Transfer any checkout inventory reservations to the order
      await clientOrDb.query(
        `UPDATE inventory_reservations
         SET reference_type = 'order', reference_id = $1, updated_at = NOW()
         WHERE store_id = $2 AND reference_type = 'checkout' AND reference_id = $3`,
        [existingOrderRow.id, storeId, paymentRow.checkout_id],
      );

      // Hydrate order
      const order = await this.orderService.getOrderById(
        clientOrDb,
        storeId,
        existingOrderRow.id,
      );
      if (!order) {
        throw new PaymentValidationError(
          `Existing order '${existingOrderRow.id}' not found for payment '${paymentId}'`,
        );
      }

      // Complete checkout if not yet completed
      const checkoutDto = await this.checkoutService.completeCheckout(
        clientOrDb,
        storeId,
        paymentRow.checkout_id,
      );

      // Idempotently ensure discount redemption is recorded for existing order
      if (existingOrderRow.discount_id && Number(existingOrderRow.discount_total) > 0) {
        try {
          await this.discountRedemptionService.recordRedemption(clientOrDb, storeId, {
            discountId: existingOrderRow.discount_id,
            orderId: existingOrderRow.id,
            checkoutId: existingOrderRow.checkout_id,
            customerId: existingOrderRow.customer_id,
            amount: Number(existingOrderRow.discount_total),
            currency: existingOrderRow.currency,
          });
        } catch (discountErr) {
          console.error(
            `[completePurchaseWorkflow] Failed to idempotently ensure discount redemption for order '${existingOrderRow.id}':`,
            discountErr,
          );
        }
      }

      // Idempotently ensure gift card & store credit redemption is recorded for existing order
      if (existingOrderRow.checkout_id) {
        try {
          await this.giftCardService.redeemCheckoutGiftCardsForOrder(clientOrDb, {
            storeId,
            checkoutId: existingOrderRow.checkout_id,
            orderId: existingOrderRow.id,
            currency: existingOrderRow.currency,
            maxAmountToRedeem: Math.max(0, Number(existingOrderRow.grand_total) - Number(paymentRow.amount)),
          });
          await this.giftCardService.redeemCheckoutStoreCreditForOrder(clientOrDb, {
            storeId,
            checkoutId: existingOrderRow.checkout_id,
            orderId: existingOrderRow.id,
            currency: existingOrderRow.currency,
          });
        } catch (giftCardErr) {
          console.error(
            `[completePurchaseWorkflow] Failed to idempotently ensure stored value redemption for order '${existingOrderRow.id}':`,
            giftCardErr,
          );
        }
      }

      return finish({
        payment: toPaymentDTO(updatedPaymentRow ?? paymentRow),
        order,
        checkout: checkoutDto,
        orderCreated: false,
      });
    }

    // 4. Load Trusted Checkout Snapshot
    const checkout = await this.checkoutRepo.findWithItems(
      clientOrDb,
      storeId,
      paymentRow.checkout_id,
    );

    if (!checkout) {
      throw new PurchaseWorkflowBlockedError(
        `Checkout '${paymentRow.checkout_id}' not found for store '${storeId}'`,
      );
    }

    if (checkout.items.length === 0) {
      throw new PurchaseWorkflowBlockedError(
        `Checkout '${paymentRow.checkout_id}' has no items and cannot create an order`,
      );
    }

    if (checkout.status === "CANCELLED" || checkout.status === "EXPIRED" || checkout.status === "FAILED") {
      throw new PurchaseWorkflowBlockedError(
        `Checkout '${paymentRow.checkout_id}' is in terminal status '${checkout.status}' and cannot create an order`,
      );
    }

    if (checkout.currency.toUpperCase() !== paymentRow.currency.toUpperCase()) {
      throw new PurchaseWorkflowBlockedError(
        `Checkout currency '${checkout.currency}' does not match payment currency '${paymentRow.currency}'`,
      );
    }

    if (Number(checkout.total) !== Number(paymentRow.amount)) {
      throw new PurchaseWorkflowBlockedError(
        `Checkout total (${checkout.total}) does not match payment amount (${paymentRow.amount})`,
      );
    }

    // Per-line discount and tax. When a tax snapshot exists and agrees with the
    // tax that was actually charged, each line takes its frozen figures.
    // Otherwise the checkout-level discount is still spread across the lines in
    // proportion to their value, because a line that records no discount would
    // later be refunded at full price by a return. The order total itself is
    // always the checkout's, so this only affects how it is itemised.
    const taxSnapshot = await this.taxService.getCheckoutTaxSnapshot(
      clientOrDb,
      storeId,
      checkout.id,
    );
    const snapshotLines =
      taxSnapshot && taxSnapshot.taxTotal === checkout.taxTotal
        ? new Map(taxSnapshot.lines.map((line) => [line.lineId, line]))
        : null;
    const grossAmounts = checkout.items.map((i) => i.unitPrice * i.quantity);
    const grossTotal = grossAmounts.reduce((sum, gross) => sum + gross, 0);
    const allocatedDiscounts = allocateByWeight(
      Math.min(checkout.discountTotal, grossTotal),
      grossAmounts,
    );

    const trustedCheckout: TrustedCheckoutData = {
      id: checkout.id,
      storeId: checkout.storeId,
      customerId: checkout.customerId,
      guestTokenHash: checkout.guestTokenHash,
      currency: checkout.currency,
      subtotal: checkout.subtotal,
      discountTotal: checkout.discountTotal,
      discountId: checkout.discountId,
      discountCode: checkout.discountCode,
      shippingTotal: checkout.shippingTotal,
      taxTotal: checkout.taxTotal,
      pricesIncludeTax: Boolean(taxSnapshot?.pricesIncludeTax),
      total: checkout.total,
      items: checkout.items.map((i, index) => {
        const snapshotLine = snapshotLines?.get(i.variantId);
        return {
          variantId: i.variantId,
          productNameSnapshot: i.productNameSnapshot,
          variantNameSnapshot: i.variantNameSnapshot,
          skuSnapshot: i.skuSnapshot,
          unitPrice: i.unitPrice,
          quantity: i.quantity,
          discountAmount: snapshotLine?.discountAmount ?? allocatedDiscounts[index] ?? 0,
          taxAmount: snapshotLine?.taxAmount ?? 0,
        };
      }),
      billingAddress: checkout.billingAddress
        ? {
            name:
              [checkout.billingAddress.firstName, checkout.billingAddress.lastName]
                .filter(Boolean)
                .join(" ") || "Customer",
            firstName: checkout.billingAddress.firstName,
            lastName: checkout.billingAddress.lastName,
            addressLine1: checkout.billingAddress.addressLine1,
            addressLine2: checkout.billingAddress.addressLine2,
            city: checkout.billingAddress.city,
            state: checkout.billingAddress.state,
            postalCode: checkout.billingAddress.postalCode,
            country: checkout.billingAddress.country,
            phone: checkout.billingAddress.phone,
          }
        : null,
      shippingAddress: checkout.shippingAddress
        ? {
            name:
              [checkout.shippingAddress.firstName, checkout.shippingAddress.lastName]
                .filter(Boolean)
                .join(" ") || "Customer",
            firstName: checkout.shippingAddress.firstName,
            lastName: checkout.shippingAddress.lastName,
            addressLine1: checkout.shippingAddress.addressLine1,
            addressLine2: checkout.shippingAddress.addressLine2,
            city: checkout.shippingAddress.city,
            state: checkout.shippingAddress.state,
            postalCode: checkout.shippingAddress.postalCode,
            country: checkout.shippingAddress.country,
            phone: checkout.shippingAddress.phone,
          }
        : null,
    };

    // 5. Create Order via OrderService (Idempotent across concurrent calls)
    let order = await this.orderService.createOrderFromCheckout(clientOrDb, {
      storeId,
      checkout: trustedCheckout,
      paymentId: paymentRow.id,
    });

    // 6. Update Order Payment Status to PAID
    order = await this.orderStatusService.updatePaymentStatus(clientOrDb, {
      storeId,
      orderId: order.id,
      paymentStatus: "PAID",
      authorizedInternalCall: true,
      reason: "Payment captured and verified by gateway",
    });

    // 7. Link Payment to Order and transfer inventory reservations
    const updatedPaymentRow = await this.paymentRepo.updateStatus(
      clientOrDb,
      storeId,
      paymentRow.id,
      paymentRow.status,
      { orderId: order.id },
    );

    await clientOrDb.query(
      `UPDATE inventory_reservations
       SET reference_type = 'order', reference_id = $1, updated_at = NOW()
       WHERE store_id = $2 AND reference_type = 'checkout' AND reference_id = $3`,
      [order.id, storeId, paymentRow.checkout_id],
    );

    // 8. Record Discount Redemption if discount applied
    if (checkout.discountId && checkout.discountTotal > 0) {
      try {
        await this.discountRedemptionService.recordRedemption(clientOrDb, storeId, {
          discountId: checkout.discountId,
          orderId: order.id,
          checkoutId: checkout.id,
          customerId: checkout.customerId,
          amount: checkout.discountTotal,
          currency: checkout.currency,
        });
      } catch (discountErr) {
        console.error(
          `[completePurchaseWorkflow] Failed to record discount redemption for order '${order.id}', discount '${checkout.discountId}':`,
          discountErr,
        );
      }
    }

    // 8b. Redeem Applied Gift Cards & Store Credit if any (clamped to remaining payable total)
    let totalGiftCardsRedeemed = 0;
    try {
      const maxStoredValue = Math.max(0, order.grandTotal - Number(paymentRow.amount));
      const gcRes = await this.giftCardService.redeemCheckoutGiftCardsForOrder(clientOrDb, {
        storeId,
        checkoutId: checkout.id,
        orderId: order.id,
        currency: checkout.currency,
        maxAmountToRedeem: maxStoredValue,
      });
      totalGiftCardsRedeemed = gcRes.totalRedeemed;
    } catch (giftCardErr) {
      console.error(
        `[completePurchaseWorkflow] Failed to redeem gift cards for order '${order.id}', checkout '${checkout.id}':`,
        giftCardErr,
      );
    }

    try {
      const remainingForCredit = Math.max(0, order.grandTotal - Number(paymentRow.amount) - totalGiftCardsRedeemed);
      await this.giftCardService.redeemCheckoutStoreCreditForOrder(clientOrDb, {
        storeId,
        checkoutId: checkout.id,
        orderId: order.id,
        currency: checkout.currency,
        maxAmountToRedeem: remainingForCredit,
      });
    } catch (storeCreditErr) {
      console.error(
        `[completePurchaseWorkflow] Failed to redeem store credit for order '${order.id}', checkout '${checkout.id}':`,
        storeCreditErr,
      );
    }

    // 9. Complete Checkout
    const completedCheckout = await this.checkoutService.completeCheckout(
      clientOrDb,
      storeId,
      paymentRow.checkout_id,
    );

    // 9. Queue Order Confirmation Notification (Idempotent via order_confirmed:<orderId>, fail-open)
    await this.notificationOutboxService.queueOrderConfirmation(clientOrDb, {
      storeId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      currency: order.currency,
      subtotal: order.subtotal,
      discountTotal: order.discountTotal,
      shippingTotal: order.shippingTotal,
      taxTotal: order.taxTotal,
      grandTotal: order.grandTotal,
      recipientEmail: checkout.email || completedCheckout.email,
      recipientName:
        [checkout.shippingAddress?.firstName, checkout.shippingAddress?.lastName]
          .filter(Boolean)
          .join(" ") || undefined,
      items: order.items?.map((item) => ({
        name: item.productNameSnapshot,
        variantTitle: item.variantNameSnapshot,
        sku: item.skuSnapshot,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
      shippingAddress: checkout.shippingAddress,
    });

    // 10. Queue Merchant New Order Notification (Idempotent via merchant_order_alert:<orderId>, fail-open)
    await this.notificationOutboxService.queueMerchantNewOrder(clientOrDb, {
      storeId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      currency: order.currency,
      subtotal: order.subtotal,
      discountTotal: order.discountTotal,
      shippingTotal: order.shippingTotal,
      taxTotal: order.taxTotal,
      grandTotal: order.grandTotal,
      customerEmail: checkout.email || completedCheckout.email,
      customerName:
        [checkout.shippingAddress?.firstName, checkout.shippingAddress?.lastName]
          .filter(Boolean)
          .join(" ") || undefined,
      items: order.items?.map((item) => ({
        name: item.productNameSnapshot,
        variantTitle: item.variantNameSnapshot,
        sku: item.skuSnapshot,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
      shippingAddress: checkout.shippingAddress,
    });

    // The tax invoice is deliberately NOT issued inside this transaction. See
    // `issueInvoiceBestEffort`: when this runs on a pool it is safe to issue
    // here; when it runs inside `finalizeCapturedPurchase`'s transaction the
    // invoice is issued after that transaction commits instead.
    await this.issueInvoiceBestEffort(clientOrDb, order);

    // Auto-issue any digital gift cards purchased in this order
    await this.issuePurchasedGiftCardsBestEffort(
      clientOrDb,
      storeId,
      order,
      checkout.email || completedCheckout.email,
      [checkout.shippingAddress?.firstName, checkout.shippingAddress?.lastName]
        .filter(Boolean)
        .join(" "),
    );

    return finish({
      payment: toPaymentDTO(updatedPaymentRow ?? paymentRow),
      order,
      checkout: completedCheckout,
      orderCreated: true,
    });
  }

  /**
   * Copies the checkout's shipping and billing addresses onto the customer.
   * Runs only on a pool connection, in its own transaction, so a failure
   * cannot roll back an order the customer has already paid for.
   * Repeated calls keep a single row per unique recipient and location.
   */
  private async rememberCheckoutAddresses(
    clientOrDb: Database | DatabaseClient,
    checkout: CheckoutDTO,
  ): Promise<void> {
    if (typeof (clientOrDb as Database).withTransaction !== "function") {
      return;
    }
    if (!checkout.customerId) {
      return;
    }

    const addresses = [checkout.shippingAddress, checkout.billingAddress].filter(
      (address): address is CheckoutAddressDTO => address !== null,
    );
    if (addresses.length === 0) {
      return;
    }

    try {
      await this.customerService.rememberUniqueAddresses(
        clientOrDb,
        checkout.storeId,
        checkout.customerId,
        addresses.map((address) => ({
          firstName: address.firstName,
          lastName: address.lastName,
          addressLine1: address.addressLine1,
          addressLine2: address.addressLine2,
          city: address.city,
          state: address.state,
          postalCode: address.postalCode,
          country: address.country,
          phone: address.phone,
        })),
      );
    } catch (err: unknown) {
      console.error(
        `[completePurchaseWorkflow] Failed to save addresses for customer '${checkout.customerId}' in store '${checkout.storeId}':`,
        err instanceof Error ? err.name : "Error",
      );
    }
  }

  /**
   * Issues the GST invoice for a paid order, best effort, and only OUTSIDE a
   * caller-owned transaction.
   *
   * The database layer is fail-fast: once any statement in a transaction
   * fails it latches that error and rejects every later statement, including a
   * ROLLBACK TO SAVEPOINT. So an invoice problem raised inside the purchase
   * transaction cannot be contained: it would abort the whole transaction and
   * roll back an order the customer has already paid for. Invoicing therefore
   * runs in its own transaction on a pool, after the purchase has committed.
   *
   * Handed a transaction client there is no safe way to isolate the work, so
   * it is skipped. That is harmless: the invoice is issued, idempotently, on
   * the first download request, and `finalizeCapturedPurchase` issues it right
   * after commit on every production path.
   */
  private async issueInvoiceBestEffort(
    clientOrDb: Database | DatabaseClient,
    order: OrderDTO,
  ): Promise<void> {
    if (typeof (clientOrDb as Database).withTransaction !== "function") {
      return;
    }
    const input = buildIssueInvoiceInput(order);
    if (input) {
      await this.taxService.tryIssueInvoiceForOrder(clientOrDb, input);
    }
  }

  /**
   * Runs order creation after a capture has already been committed.
   * A blocked checkout is recorded on the payment so retries stop.
   * A payment that is no longer CAPTURED is skipped and left unchanged.
   */
  async finalizeCapturedPurchase(
    clientOrDb: Database | DatabaseClient,
    input: CompletePurchaseWorkflowInput,
  ): Promise<
    | { status: "completed"; workflow: PurchaseWorkflowResult }
    | { status: "blocked"; reason: string }
    | { status: "skipped"; reason: string }
  > {
    try {
      const workflow = await runInTransaction(clientOrDb, (tx) =>
        this.completePurchaseWorkflow(tx, input),
      );
      // The purchase is committed. Invoice it now, in its own transaction, so
      // an invoicing failure can never undo a paid order.
      await this.issueInvoiceBestEffort(clientOrDb, workflow.order);
      await this.rememberCheckoutAddresses(clientOrDb, workflow.checkout);
      return { status: "completed", workflow };
    } catch (err: unknown) {
      let activeErr = err;
      const pgErr = activeErr as { code?: string; constraint?: string; message?: string };
      // Handle concurrent order creation race (e.g. callback and webhook arriving simultaneously)
      if (
        pgErr.code === "23505" &&
        (pgErr.constraint?.includes("checkout") ||
          pgErr.constraint === "orders_store_checkout_idx" ||
          pgErr.message?.includes("orders_store_checkout_idx"))
      ) {
        try {
          const retriedWorkflow = await runInTransaction(clientOrDb, (tx) =>
            this.completePurchaseWorkflow(tx, input),
          );
          await this.issueInvoiceBestEffort(clientOrDb, retriedWorkflow.order);
          await this.rememberCheckoutAddresses(clientOrDb, retriedWorkflow.checkout);
          return { status: "completed", workflow: retriedWorkflow };
        } catch (retryErr) {
          activeErr = retryErr;
        }
      }

      if (activeErr instanceof PurchaseWorkflowBlockedError) {
        await this.paymentRepo.setReconciliationReason(
          clientOrDb,
          input.storeId,
          input.paymentId,
          activeErr.message,
        );
        return { status: "blocked", reason: activeErr.message };
      }
      if (
        activeErr instanceof PaymentValidationError &&
        activeErr.message.includes("requires CAPTURED")
      ) {
        return { status: "skipped", reason: activeErr.message };
      }
      throw activeErr;
    }
  }

  /**
   * Completes a checkout that has no gateway payment (zero-total or Cash on Delivery).
   * The checkout state machine only allows OPEN -> PAYMENT_PENDING -> COMPLETED, so an
   * OPEN checkout must first enter the payment lifecycle through the domain's own
   * beginPayment() transition (the same step the Razorpay coordinator performs).
   * Already-pending checkouts are left as is; COMPLETED is handled by completeCheckout.
   */
  private async completeCheckoutViaPaymentPending(
    tx: DatabaseClient,
    storeId: string,
    checkoutId: string,
  ): Promise<CheckoutDTO> {
    const current = await this.checkoutRepo.findWithItems(tx, storeId, checkoutId);
    if (current && current.status === "OPEN") {
      await this.checkoutService.beginPayment(tx, storeId, checkoutId);
    }
    return this.checkoutService.completeCheckout(tx, storeId, checkoutId);
  }

  /**
   * Finalizes a checkout when payable total is zero (e.g. 100% covered by gift cards).
   * Creates the order directly, marks it PAID, redeems the gift cards, and marks the checkout COMPLETED.
   */
  async completeZeroPaymentPurchaseWorkflow(
    clientOrDb: Database | DatabaseClient,
    input: { storeId: string; checkoutId: string },
  ): Promise<{ order: OrderDTO; checkout: CheckoutDTO }> {
    const { storeId, checkoutId } = input;

    const workflow = await runInTransaction(clientOrDb, async (tx) => {
      // 1. Check existing order idempotently
      const existingOrder = await this.orderRepo.findByCheckoutId(tx, storeId, checkoutId);
      if (existingOrder) {
        const order = await this.orderService.getOrderById(tx, storeId, existingOrder.id);
        const checkoutEntity = await this.checkoutRepo.findWithItems(tx, storeId, checkoutId);
        let checkoutDto: CheckoutDTO;
        if (checkoutEntity && checkoutEntity.status !== "COMPLETED") {
          checkoutDto = await this.completeCheckoutViaPaymentPending(tx, storeId, checkoutId);
        } else if (checkoutEntity) {
          const appliedCards = await this.giftCardService.getCheckoutGiftCards(tx, storeId, checkoutId);
          const appliedStoreCredit = await this.giftCardService.getCheckoutStoreCredit(tx, storeId, checkoutId);
          checkoutDto = toCheckoutDTO(checkoutEntity, null, appliedCards, appliedStoreCredit);
        } else {
          throw new PurchaseWorkflowBlockedError(`Checkout '${checkoutId}' not found`);
        }
        return { order: order!, checkout: checkoutDto, orderCreated: false };
      }

      // 2. Load checkout
      const checkout = await this.checkoutRepo.findWithItems(tx, storeId, checkoutId);
      if (!checkout) {
        throw new PurchaseWorkflowBlockedError(`Checkout '${checkoutId}' not found in store '${storeId}'`);
      }

      const grossTotal = Math.max(
        0,
        checkout.subtotal - checkout.discountTotal + checkout.taxTotal + checkout.shippingTotal,
      );
      const appliedCards = await this.giftCardService.getCheckoutGiftCards(tx, storeId, checkoutId);
      const giftCardTotal = appliedCards.reduce((acc, c) => acc + c.appliedAmount, 0);
      const appliedStoreCredit = await this.giftCardService.getCheckoutStoreCredit(tx, storeId, checkoutId);
      const storeCreditTotal = appliedStoreCredit?.appliedAmount ?? 0;

      if (grossTotal > giftCardTotal + storeCreditTotal) {
        throw new PurchaseWorkflowBlockedError(
          `Checkout cannot be completed with zero payment: gross total ${grossTotal} exceeds applied stored value ${giftCardTotal + storeCreditTotal}`,
        );
      }

      // Build trusted checkout snapshot for order creation
      const trustedCheckout = {
        id: checkout.id,
        storeId: checkout.storeId,
        cartId: checkout.cartId,
        customerId: checkout.customerId,
        email: checkout.email,
        currency: checkout.currency,
        subtotal: checkout.subtotal,
        discountTotal: checkout.discountTotal,
        discountId: checkout.discountId,
        discountCode: checkout.discountCode,
        shippingTotal: checkout.shippingTotal,
        taxTotal: checkout.taxTotal,
        total: 0,
        items: checkout.items.map((i) => ({
          variantId: i.variantId,
          productNameSnapshot: i.productNameSnapshot,
          variantNameSnapshot: i.variantNameSnapshot,
          skuSnapshot: i.skuSnapshot,
          unitPrice: i.unitPrice,
          quantity: i.quantity,
          lineTotal: i.lineTotal,
        })),
        shippingAddress: checkout.shippingAddress
          ? {
              recipientName:
                [checkout.shippingAddress.firstName, checkout.shippingAddress.lastName]
                  .filter(Boolean)
                  .join(" ") || "Customer",
              firstName: checkout.shippingAddress.firstName,
              lastName: checkout.shippingAddress.lastName,
              addressLine1: checkout.shippingAddress.addressLine1,
              addressLine2: checkout.shippingAddress.addressLine2,
              city: checkout.shippingAddress.city,
              state: checkout.shippingAddress.state,
              postalCode: checkout.shippingAddress.postalCode,
              country: checkout.shippingAddress.country,
              phone: checkout.shippingAddress.phone,
            }
          : null,
      };

      // 3. Create Order
      let order = await this.orderService.createOrderFromCheckout(tx, {
        storeId,
        checkout: trustedCheckout,
      });

      // 4. Mark order as PAID
      order = await this.orderStatusService.updatePaymentStatus(tx, {
        storeId,
        orderId: order.id,
        paymentStatus: "PAID",
        authorizedInternalCall: true,
        reason: "Paid in full via gift card",
      });

      // 5. Transfer inventory reservations
      await tx.query(
        `UPDATE inventory_reservations
         SET reference_type = 'order', reference_id = $1, updated_at = NOW()
         WHERE store_id = $2 AND reference_type = 'checkout' AND reference_id = $3`,
        [order.id, storeId, checkoutId],
      );

      // 6. Record discount redemption if applied
      if (checkout.discountId && checkout.discountTotal > 0) {
        try {
          await this.discountRedemptionService.recordRedemption(tx, storeId, {
            discountId: checkout.discountId,
            orderId: order.id,
            checkoutId: checkout.id,
            customerId: checkout.customerId,
            amount: checkout.discountTotal,
            currency: checkout.currency,
          });
        } catch (discountErr) {
          console.error(
            `[completeZeroPaymentPurchaseWorkflow] Failed to record discount redemption for order '${order.id}':`,
            discountErr,
          );
        }
      }

      // 7. Redeem Gift Cards & Store Credit (fail-closed: zero-payment orders require valid stored value balance)
      let redeemedGiftCards = 0;
      try {
        const gcRes = await this.giftCardService.redeemCheckoutGiftCardsForOrder(tx, {
          storeId,
          checkoutId: checkout.id,
          orderId: order.id,
          currency: checkout.currency,
          maxAmountToRedeem: grossTotal,
        });
        redeemedGiftCards = gcRes.totalRedeemed;
      } catch (giftCardErr) {
        throw new PurchaseWorkflowBlockedError(
          `Gift card redemption failed: ${giftCardErr instanceof Error ? giftCardErr.message : "Insufficient balance"}`,
        );
      }

      const remainingForStoreCredit = Math.max(0, grossTotal - redeemedGiftCards);
      if (remainingForStoreCredit > 0 && storeCreditTotal > 0) {
        try {
          await this.giftCardService.redeemCheckoutStoreCreditForOrder(tx, {
            storeId,
            checkoutId: checkout.id,
            orderId: order.id,
            currency: checkout.currency,
            maxAmountToRedeem: remainingForStoreCredit,
          });
        } catch (storeCreditErr) {
          throw new PurchaseWorkflowBlockedError(
            `Store credit redemption failed: ${storeCreditErr instanceof Error ? storeCreditErr.message : "Insufficient balance"}`,
          );
        }
      }

      // 8. Complete Checkout
      const completedCheckout = await this.completeCheckoutViaPaymentPending(tx, storeId, checkoutId);

      // 9. Queue order confirmation
      await this.notificationOutboxService.queueOrderConfirmation(tx, {
        storeId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        currency: order.currency,
        subtotal: order.subtotal,
        discountTotal: order.discountTotal,
        shippingTotal: order.shippingTotal,
        taxTotal: order.taxTotal,
        grandTotal: order.grandTotal,
        recipientEmail: checkout.email || completedCheckout.email || "",
        recipientName:
          [checkout.shippingAddress?.firstName, checkout.shippingAddress?.lastName]
            .filter(Boolean)
            .join(" ") || undefined,
        items: (order.items || []).map((item) => ({
          name: item.productNameSnapshot,
          variantTitle: item.variantNameSnapshot,
          sku: item.skuSnapshot,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        })),
        shippingAddress: checkout.shippingAddress,
      });

      // Auto-issue any digital gift cards purchased in this order
      await this.issuePurchasedGiftCardsBestEffort(
        tx,
        storeId,
        order,
        checkout.email || completedCheckout.email,
        [checkout.shippingAddress?.firstName, checkout.shippingAddress?.lastName]
          .filter(Boolean)
          .join(" "),
      );

      return { order, checkout: completedCheckout, orderCreated: true };
    });

    if (workflow.orderCreated) {
      void globalEventBus.publish({
        eventId: generateUuidV7(),
        eventType: "order.created",
        occurredAt: new Date(),
        payload: {
          storeId,
          orderId: workflow.order.id,
          orderNumber: workflow.order.orderNumber,
          customerId: workflow.order.customerId,
          total: Number(workflow.order.total),
          currency: workflow.order.currency,
        },
      });

      void globalEventBus.publish({
        eventId: generateUuidV7(),
        eventType: "order.paid",
        occurredAt: new Date(),
        payload: {
          storeId,
          orderId: workflow.order.id,
          orderNumber: workflow.order.orderNumber,
          paymentId: workflow.order.paymentId ?? "",
          amount: Number(workflow.order.total),
          currency: workflow.order.currency,
        },
      });
    }

    // The order is committed. Save the checkout addresses on the customer in their own
    // transaction: rememberCheckoutAddresses skips transaction clients, so calling it from
    // inside the workflow transaction silently saved nothing.
    await this.rememberCheckoutAddresses(clientOrDb, workflow.checkout);

    return { order: workflow.order, checkout: workflow.checkout };
  }

  /**
   * Finalizes a checkout with Cash on Delivery (COD).
   * Creates the order in CONFIRMED status with PENDING payment status,
   * records a local payment in PENDING status with provider 'COD',
   * transfers inventory reservations from checkout to order,
   * records discount redemption, redeems applied gift cards,
   * completes checkout, and queues order confirmation notification.
   */
  async completeCodPurchaseWorkflow(
    clientOrDb: Database | DatabaseClient,
    input: { storeId: string; checkoutId: string },
  ): Promise<{ order: OrderDTO; checkout: CheckoutDTO }> {
    const { storeId, checkoutId } = input;

    const workflow = await runInTransaction(clientOrDb, async (tx) => {
      // 1. Check existing order idempotently
      const existingOrder = await this.orderRepo.findByCheckoutId(tx, storeId, checkoutId);
      if (existingOrder) {
        const order = await this.orderService.getOrderById(tx, storeId, existingOrder.id);
        const checkoutEntity = await this.checkoutRepo.findWithItems(tx, storeId, checkoutId);
        let checkoutDto: CheckoutDTO;
        if (checkoutEntity && checkoutEntity.status !== "COMPLETED") {
          checkoutDto = await this.completeCheckoutViaPaymentPending(tx, storeId, checkoutId);
        } else if (checkoutEntity) {
          const appliedCards = await this.giftCardService.getCheckoutGiftCards(tx, storeId, checkoutId);
          const appliedStoreCredit = await this.giftCardService.getCheckoutStoreCredit(tx, storeId, checkoutId);
          checkoutDto = toCheckoutDTO(checkoutEntity, null, appliedCards, appliedStoreCredit);
        } else {
          throw new PurchaseWorkflowBlockedError(`Checkout '${checkoutId}' not found`);
        }
        return { order: order!, checkout: checkoutDto, orderCreated: false };
      }

      // 2. Load checkout
      const checkout = await this.checkoutRepo.findWithItems(tx, storeId, checkoutId);
      if (!checkout) {
        throw new PurchaseWorkflowBlockedError(`Checkout '${checkoutId}' not found in store '${storeId}'`);
      }
      if (checkout.items.length === 0) {
        throw new PurchaseWorkflowBlockedError("Cannot complete checkout with empty items");
      }

      const grossTotal = Math.max(
        0,
        checkout.subtotal - checkout.discountTotal + checkout.taxTotal + checkout.shippingTotal,
      );
      const appliedCards = await this.giftCardService.getCheckoutGiftCards(tx, storeId, checkoutId);
      const giftCardTotal = appliedCards.reduce((acc, c) => acc + c.appliedAmount, 0);
      const appliedStoreCredit = await this.giftCardService.getCheckoutStoreCredit(tx, storeId, checkoutId);
      const storeCreditTotal = appliedStoreCredit?.appliedAmount ?? 0;
      const payableAmount = Math.max(0, grossTotal - giftCardTotal - storeCreditTotal);

      // Cancel any prior non-captured payment attempts to prevent zombie sessions
      const existingActivePayments = await this.paymentRepo.findByCheckoutId(tx, storeId, checkoutId);
      for (const p of existingActivePayments) {
        if (p.status !== "CAPTURED" && p.status !== "FAILED" && p.status !== "CANCELLED") {
          await this.paymentRepo.updateStatus(tx, storeId, p.id, "CANCELLED");
        }
      }

      // 3. Create COD Payment record
      const paymentId = generateUuidV7();
      await this.paymentRepo.create(tx, {
        id: paymentId,
        storeId,
        checkoutId,
        amount: payableAmount,
        currency: checkout.currency,
        status: "PENDING",
        provider: "COD",
        capturedAmount: 0,
        refundedAmount: 0,
      });

      // 4. Build trusted checkout snapshot for order creation
      const taxSnapshot = await this.taxService.getCheckoutTaxSnapshot(
        tx,
        storeId,
        checkout.id,
      );
      const snapshotLines =
        taxSnapshot && taxSnapshot.taxTotal === checkout.taxTotal
          ? new Map(taxSnapshot.lines.map((line) => [line.lineId, line]))
          : null;
      const grossAmounts = checkout.items.map((i) => i.unitPrice * i.quantity);
      const grossItemTotal = grossAmounts.reduce((sum, gross) => sum + gross, 0);
      const allocatedDiscounts = allocateByWeight(
        Math.min(checkout.discountTotal, grossItemTotal),
        grossAmounts,
      );

      const trustedCheckout: TrustedCheckoutData = {
        id: checkout.id,
        storeId: checkout.storeId,
        customerId: checkout.customerId,
        guestTokenHash: checkout.guestTokenHash,
        currency: checkout.currency,
        subtotal: checkout.subtotal,
        discountTotal: checkout.discountTotal,
        discountId: checkout.discountId,
        discountCode: checkout.discountCode,
        shippingTotal: checkout.shippingTotal,
        taxTotal: checkout.taxTotal,
        total: payableAmount,
        items: checkout.items.map((i, index) => {
          const snapshotLine = snapshotLines?.get(i.variantId);
          return {
            variantId: i.variantId,
            productNameSnapshot: i.productNameSnapshot,
            variantNameSnapshot: i.variantNameSnapshot,
            skuSnapshot: i.skuSnapshot,
            unitPrice: i.unitPrice,
            quantity: i.quantity,
            discountAmount: snapshotLine?.discountAmount ?? allocatedDiscounts[index] ?? 0,
            taxAmount: snapshotLine?.taxAmount ?? 0,
            lineTotal: i.lineTotal,
          };
        }),
        billingAddress: checkout.billingAddress
          ? {
              name:
                [checkout.billingAddress.firstName, checkout.billingAddress.lastName]
                  .filter(Boolean)
                  .join(" ") || "Customer",
              firstName: checkout.billingAddress.firstName,
              lastName: checkout.billingAddress.lastName,
              addressLine1: checkout.billingAddress.addressLine1,
              addressLine2: checkout.billingAddress.addressLine2,
              city: checkout.billingAddress.city,
              state: checkout.billingAddress.state,
              postalCode: checkout.billingAddress.postalCode,
              country: checkout.billingAddress.country,
              phone: checkout.billingAddress.phone,
            }
          : null,
        shippingAddress: checkout.shippingAddress
          ? {
              name:
                [checkout.shippingAddress.firstName, checkout.shippingAddress.lastName]
                  .filter(Boolean)
                  .join(" ") || "Customer",
              firstName: checkout.shippingAddress.firstName,
              lastName: checkout.shippingAddress.lastName,
              addressLine1: checkout.shippingAddress.addressLine1,
              addressLine2: checkout.shippingAddress.addressLine2,
              city: checkout.shippingAddress.city,
              state: checkout.shippingAddress.state,
              postalCode: checkout.shippingAddress.postalCode,
              country: checkout.shippingAddress.country,
              phone: checkout.shippingAddress.phone,
            }
          : null,
      };

      // 5. Create Order via OrderService with initialStatus: "CONFIRMED"
      const order = await this.orderService.createOrderFromCheckout(tx, {
        storeId,
        checkout: trustedCheckout,
        paymentId,
        initialStatus: "CONFIRMED",
      });

      // 6. Link Payment to Order
      await this.paymentRepo.updateStatus(tx, storeId, paymentId, "PENDING", {
        orderId: order.id,
      });

      // 7. Transfer inventory reservations
      await tx.query(
        `UPDATE inventory_reservations
         SET reference_type = 'order', reference_id = $1, updated_at = NOW()
         WHERE store_id = $2 AND reference_type = 'checkout' AND reference_id = $3`,
        [order.id, storeId, checkoutId],
      );

      // 8. Record discount redemption if applied
      if (checkout.discountId && checkout.discountTotal > 0) {
        try {
          await this.discountRedemptionService.recordRedemption(tx, storeId, {
            discountId: checkout.discountId,
            orderId: order.id,
            checkoutId: checkout.id,
            customerId: checkout.customerId,
            amount: checkout.discountTotal,
            currency: checkout.currency,
          });
        } catch (discountErr) {
          console.error(
            `[completeCodPurchaseWorkflow] Failed to record discount redemption for order '${order.id}':`,
            discountErr,
          );
        }
      }

      // 9. Redeem Gift Cards & Store Credit if any (fail-closed: partial stored value balance must be debited)
      if (giftCardTotal > 0) {
        try {
          await this.giftCardService.redeemCheckoutGiftCardsForOrder(tx, {
            storeId,
            checkoutId: checkout.id,
            orderId: order.id,
            currency: checkout.currency,
            maxAmountToRedeem: giftCardTotal,
          });
        } catch (giftCardErr) {
          throw new PurchaseWorkflowBlockedError(
            `Failed to redeem applied gift card for COD order: ${giftCardErr instanceof Error ? giftCardErr.message : "Insufficient balance"}`,
          );
        }
      }

      if (storeCreditTotal > 0) {
        try {
          await this.giftCardService.redeemCheckoutStoreCreditForOrder(tx, {
            storeId,
            checkoutId: checkout.id,
            orderId: order.id,
            currency: checkout.currency,
            maxAmountToRedeem: storeCreditTotal,
          });
        } catch (storeCreditErr) {
          throw new PurchaseWorkflowBlockedError(
            `Failed to redeem applied store credit for COD order: ${storeCreditErr instanceof Error ? storeCreditErr.message : "Insufficient balance"}`,
          );
        }
      }

      // 10. Complete Checkout
      const completedCheckout = await this.completeCheckoutViaPaymentPending(tx, storeId, checkoutId);

      // 11. Queue Order Confirmation Notification
      await this.notificationOutboxService.queueOrderConfirmation(tx, {
        storeId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        currency: order.currency,
        subtotal: order.subtotal,
        discountTotal: order.discountTotal,
        shippingTotal: order.shippingTotal,
        taxTotal: order.taxTotal,
        grandTotal: order.grandTotal,
        recipientEmail: checkout.email || completedCheckout.email || "",
        recipientName:
          [checkout.shippingAddress?.firstName, checkout.shippingAddress?.lastName]
            .filter(Boolean)
            .join(" ") || undefined,
        items: (order.items || []).map((item) => ({
          name: item.productNameSnapshot,
          variantTitle: item.variantNameSnapshot,
          sku: item.skuSnapshot,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        })),
        shippingAddress: checkout.shippingAddress,
      });

      // Auto-issue any digital gift cards purchased in this order
      await this.issuePurchasedGiftCardsBestEffort(
        tx,
        storeId,
        order,
        checkout.email || completedCheckout.email,
        [checkout.shippingAddress?.firstName, checkout.shippingAddress?.lastName]
          .filter(Boolean)
          .join(" "),
      );

      return { order, checkout: completedCheckout, orderCreated: true };
    });

    if (workflow.orderCreated) {
      void globalEventBus.publish({
        eventId: generateUuidV7(),
        eventType: "order.created",
        occurredAt: new Date(),
        payload: {
          storeId,
          orderId: workflow.order.id,
          orderNumber: workflow.order.orderNumber,
          customerId: workflow.order.customerId,
          total: Number(workflow.order.total),
          currency: workflow.order.currency,
        },
      });
    }

    // The order is committed. Save the checkout addresses on the customer in their own
    // transaction: rememberCheckoutAddresses skips transaction clients, so calling it from
    // inside the workflow transaction silently saved nothing.
    await this.rememberCheckoutAddresses(clientOrDb, workflow.checkout);

    // Best-effort invoice generation outside caller transaction
    await this.issueInvoiceBestEffort(clientOrDb, workflow.order);

    return { order: workflow.order, checkout: workflow.checkout };
  }

  /**
   * Reconciles a Cash on Delivery (COD) payment once cash is collected upon delivery.
   * 1. Finds the order and verifies store ownership.
   * 2. Finds the associated COD payment row in payments table.
   * 3. Transitions payment row status to CAPTURED, recording captured_amount = amount.
   * 4. Updates order payment_status to PAID with authorized internal privileges.
   * 5. Emits/records status history audit trail.
   */
  async markCodPaymentCollected(
    clientOrDb: Database | DatabaseClient,
    input: {
      storeId: string;
      orderId: string;
      actorId?: string | null;
      reason?: string | null;
    },
  ): Promise<{ order: OrderDTO; payment: PaymentDTO | null }> {
    const { storeId, orderId, actorId, reason } = input;

    return runInTransaction(clientOrDb, async (tx) => {
      const order = await this.orderService.getOrderById(tx, storeId, orderId);
      if (!order) {
        throw new PurchaseWorkflowBlockedError(`Order '${orderId}' not found in store '${storeId}'`);
      }

      // Idempotency: if already paid, return early
      if (order.paymentStatus === "PAID") {
        let paymentRow: PaymentRow | null = await this.paymentRepo.findByOrderId(tx, storeId, orderId);
        if (!paymentRow && order.checkoutId) {
          const checkoutPayments = await this.paymentRepo.findByCheckoutId(tx, storeId, order.checkoutId);
          paymentRow = checkoutPayments[0] ?? null;
        }
        return { order, payment: paymentRow ? toPaymentDTO(paymentRow) : null };
      }

      if (order.paymentStatus === "REFUNDED" || order.status === "CANCELLED") {
        throw new PurchaseWorkflowBlockedError(
          `Cannot collect payment for order '${orderId}' in status '${order.status}' / paymentStatus '${order.paymentStatus}'`,
        );
      }

      // Update associated payment record
      let paymentRow: PaymentRow | null = await this.paymentRepo.findByOrderId(tx, storeId, orderId);
      if (!paymentRow && order.checkoutId) {
        const checkoutPayments = await this.paymentRepo.findByCheckoutId(tx, storeId, order.checkoutId);
        paymentRow = checkoutPayments[0] ?? null;
      }

      let updatedPaymentDto: PaymentDTO | null = null;
      if (paymentRow) {
        if (paymentRow.status !== "CAPTURED") {
          const updatedRow = await this.paymentRepo.updateStatus(
            tx,
            storeId,
            paymentRow.id,
            "CAPTURED",
            { capturedAmount: Number(paymentRow.amount), orderId },
          );
          if (updatedRow) {
            updatedPaymentDto = toPaymentDTO(updatedRow);
          }
        } else {
          updatedPaymentDto = toPaymentDTO(paymentRow);
        }
      }

      // Transition order payment status to PAID
      const updatedOrder = await this.orderStatusService.updatePaymentStatus(tx, {
        storeId,
        orderId,
        paymentStatus: "PAID",
        authorizedInternalCall: true,
        actorType: "MERCHANT",
        actorId: actorId ?? null,
        reason: reason?.trim() || "Cash collected on delivery",
      });

      void globalEventBus.publish({
        eventId: generateUuidV7(),
        eventType: "order.paid",
        occurredAt: new Date(),
        payload: {
          storeId,
          orderId,
          orderNumber: updatedOrder.orderNumber,
          paymentId: paymentRow?.id ?? "",
          amount: Number(paymentRow?.amount ?? updatedOrder.total),
          currency: updatedOrder.currency,
        },
      });

      // Auto-issue any digital gift cards purchased once COD cash is collected
      await this.issuePurchasedGiftCardsBestEffort(
        tx,
        storeId,
        updatedOrder,
        undefined,
        undefined,
      );

      return { order: updatedOrder, payment: updatedPaymentDto };
    });
  }

  /**
   * Scans an order for digital gift card items (by SKU prefix or name) and creates
   * an active gift card balance with email delivery to the recipient.
   */
  private async issuePurchasedGiftCardsBestEffort(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    order: OrderDTO,
    recipientEmail?: string | null,
    recipientName?: string | null,
  ): Promise<void> {
    for (const item of order.items || []) {
      const isGiftCard =
        item.skuSnapshot?.toUpperCase().startsWith("GC-") ||
        item.skuSnapshot?.toUpperCase().startsWith("GIFT") ||
        item.productNameSnapshot?.toLowerCase().includes("gift card") ||
        item.variantNameSnapshot?.toLowerCase().includes("gift card");

      if (isGiftCard) {
        for (let q = 0; q < item.quantity; q++) {
          try {
            await this.giftCardService.createGiftCard(clientOrDb, storeId, {
              initialBalance: item.unitPrice,
              currency: order.currency,
              customerId: order.customerId,
              recipientEmail: recipientEmail || null,
              recipientName: recipientName || "Gift Card Recipient",
              notes: `Auto-issued from paid order #${order.orderNumber} (Item: ${item.productNameSnapshot})`,
            });
          } catch (gcErr) {
            console.error(
              `[issuePurchasedGiftCardsBestEffort] Failed to auto-issue gift card for order #${order.orderNumber}:`,
              gcErr,
            );
          }
        }
      }
    }
  }
}
