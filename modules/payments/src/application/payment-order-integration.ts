import {
  type Database,
  type DatabaseClient,
  OrderRepository,
  PaymentRepository,
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
  CheckoutRepository,
  CheckoutService,
  toCheckoutDTO,
  type CheckoutDTO,
} from "@calcart/checkout";
import {
  CrossStorePaymentAccessError,
  PaymentNotFoundError,
  PaymentValidationError,
} from "../domain/payment-errors.js";
import { toPaymentDTO, type PaymentDTO } from "./dtos.js";

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
        throw new PaymentValidationError(`Checkout '${paymentRow.checkout_id}' not found`);
      }

      return {
        payment: toPaymentDTO(paymentRow),
        order,
        checkout: checkoutDto,
        orderCreated: false,
      };
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

      return {
        payment: toPaymentDTO(updatedPaymentRow ?? paymentRow),
        order,
        checkout: checkoutDto,
        orderCreated: false,
      };
    }

    // 4. Load Trusted Checkout Snapshot
    const checkout = await this.checkoutRepo.findWithItems(
      clientOrDb,
      storeId,
      paymentRow.checkout_id,
    );

    if (!checkout) {
      throw new PaymentValidationError(
        `Checkout '${paymentRow.checkout_id}' not found for store '${storeId}'`,
      );
    }

    if (checkout.items.length === 0) {
      throw new PaymentValidationError(
        `Checkout '${paymentRow.checkout_id}' has no items and cannot create an order`,
      );
    }

    if (checkout.status === "CANCELLED" || checkout.status === "EXPIRED" || checkout.status === "FAILED") {
      throw new PaymentValidationError(
        `Checkout '${paymentRow.checkout_id}' is in terminal status '${checkout.status}' and cannot create an order`,
      );
    }

    if (checkout.currency.toUpperCase() !== paymentRow.currency.toUpperCase()) {
      throw new PaymentValidationError(
        `Checkout currency '${checkout.currency}' does not match payment currency '${paymentRow.currency}'`,
      );
    }

    if (Number(checkout.total) !== Number(paymentRow.amount)) {
      throw new PaymentValidationError(
        `Checkout total (${checkout.total}) does not match payment amount (${paymentRow.amount})`,
      );
    }

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
      total: checkout.total,
      items: checkout.items.map((i) => ({
        variantId: i.variantId,
        productNameSnapshot: i.productNameSnapshot,
        variantNameSnapshot: i.variantNameSnapshot,
        skuSnapshot: i.skuSnapshot,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        lineTotal: i.lineTotal,
      })),
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

    return {
      payment: toPaymentDTO(updatedPaymentRow ?? paymentRow),
      order,
      checkout: completedCheckout,
      orderCreated: true,
    };
  }
}
