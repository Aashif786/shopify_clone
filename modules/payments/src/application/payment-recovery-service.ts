import {
  type Database,
  type DatabaseClient,
  PaymentAttemptRepository,
  PaymentRepository,
} from "@shopify-clone/db";
import { PaymentOrderIntegration } from "./payment-order-integration.js";
import {
  WebhookRecoveryService,
  type RecoverWebhooksOptions,
  type WebhookRecoveryResult,
} from "../webhooks/webhook-recovery.js";
import { RazorpayPaymentProvider } from "../providers/razorpay-provider.js";
import { runInTransaction } from "./payment-service.js";

export interface RecoverCapturedPaymentsResult {
  recoveredCount: number;
  failedCount: number;
  payments: Array<{
    paymentId: string;
    storeId: string;
    orderId?: string;
    status: "SUCCESS" | "FAILED";
    error?: string;
  }>;
}

export interface ReconcileAmbiguousPaymentsResult {
  reconciledCount: number;
  failedCount: number;
  payments: Array<{
    paymentId: string;
    storeId: string;
    resolvedStatus: string;
    error?: string;
  }>;
}

export class PaymentRecoveryService {
  constructor(
    private readonly paymentRepo: PaymentRepository = new PaymentRepository(),
    private readonly attemptRepo: PaymentAttemptRepository = new PaymentAttemptRepository(),
    private readonly orderIntegration: PaymentOrderIntegration = new PaymentOrderIntegration(),
    private readonly webhookRecovery: WebhookRecoveryService = new WebhookRecoveryService(),
    private readonly provider?: RazorpayPaymentProvider,
  ) {}

  /**
   * Scans for payments that were successfully marked CAPTURED, but where order creation
   * or checkout completion was interrupted (e.g. process crash or network partition before order link).
   *
   * Idempotently resumes and finalizes order creation and checkout completion without
   * charging the customer again or duplicating records.
   */
  async recoverOrphanedCapturedPayments(
    clientOrDb: Database | DatabaseClient,
    options?: { limit?: number },
  ): Promise<RecoverCapturedPaymentsResult> {
    const limit = options?.limit ?? 50;
    const orphanedRows = await this.paymentRepo.findCapturedWithoutOrder(clientOrDb, limit);

    const results: RecoverCapturedPaymentsResult["payments"] = [];
    let recoveredCount = 0;
    let failedCount = 0;

    for (const payment of orphanedRows) {
      try {
        const workflowResult = await this.orderIntegration.completePurchaseWorkflow(
          clientOrDb,
          {
            storeId: payment.store_id,
            paymentId: payment.id,
          },
        );

        results.push({
          paymentId: payment.id,
          storeId: payment.store_id,
          orderId: workflowResult.order.id,
          status: "SUCCESS",
        });
        recoveredCount++;
      } catch (err) {
        failedCount++;
        results.push({
          paymentId: payment.id,
          storeId: payment.store_id,
          status: "FAILED",
          error: err instanceof Error ? err.message : "Recovery failure",
        });
      }
    }

    return {
      recoveredCount,
      failedCount,
      payments: results,
    };
  }

  /**
   * Scans for payments in REQUIRES_RECONCILIATION status (e.g. resulting from gateway timeouts)
   * and queries the provider for authoritative state.
   *
   * If the provider confirms the payment was captured, marks the local payment CAPTURED
   * and triggers order creation. If failed, marks FAILED.
   */
  async reconcileAmbiguousPayments(
    clientOrDb: Database | DatabaseClient,
    options?: { limit?: number },
  ): Promise<ReconcileAmbiguousPaymentsResult> {
    const limit = options?.limit ?? 50;
    const ambiguousRows = await this.paymentRepo.findRequiresReconciliation(clientOrDb, limit);

    const results: ReconcileAmbiguousPaymentsResult["payments"] = [];
    let reconciledCount = 0;
    let failedCount = 0;

    if (!this.provider) {
      return { reconciledCount: 0, failedCount: 0, payments: [] };
    }

    for (const payment of ambiguousRows) {
      try {
        const attempts = await this.attemptRepo.findByPaymentId(
          clientOrDb,
          payment.store_id,
          payment.id,
        );
        const latestAttempt = attempts[attempts.length - 1];

        if (!latestAttempt) {
          continue;
        }

        let resolvedStatus: string | null = null;

        // 1. If provider payment ID is available, query authoritative status
        if (latestAttempt.provider_payment_id) {
          const gatewayResult = await this.provider.getPayment(
            latestAttempt.provider_payment_id,
          );

          if (gatewayResult.status === "captured") {
            await runInTransaction(clientOrDb, async (tx) => {
              await this.paymentRepo.updateStatus(tx, payment.store_id, payment.id, "CAPTURED", {
                capturedAmount: gatewayResult.amount,
              });
              await this.attemptRepo.updateStatus(tx, payment.store_id, latestAttempt.id, "CAPTURED");
            });

            await this.orderIntegration.completePurchaseWorkflow(clientOrDb, {
              storeId: payment.store_id,
              paymentId: payment.id,
            });

            resolvedStatus = "CAPTURED";
          } else if (gatewayResult.status === "failed") {
            await runInTransaction(clientOrDb, async (tx) => {
              await this.paymentRepo.updateStatus(tx, payment.store_id, payment.id, "FAILED");
              await this.attemptRepo.updateStatus(tx, payment.store_id, latestAttempt.id, "FAILED", {
                failureCode: gatewayResult.errorCode ?? undefined,
                failureMessage: gatewayResult.errorMessage ?? undefined,
              });
            });
            resolvedStatus = "FAILED";
          }
        } else if (this.provider.findOrderByReceipt && !latestAttempt.provider_order_id) {
          // If order creation timed out, query if the order exists by receipt
          const foundOrder = await this.provider.findOrderByReceipt(latestAttempt.id);
          if (foundOrder) {
            await runInTransaction(clientOrDb, async (tx) => {
              await this.attemptRepo.updateStatus(
                tx,
                payment.store_id,
                latestAttempt.id,
                "PENDING",
                { providerOrderId: foundOrder.providerOrderId },
              );
              await this.paymentRepo.updateStatus(tx, payment.store_id, payment.id, "PENDING");
            });
            resolvedStatus = "PENDING";
          }
        }

        if (resolvedStatus) {
          reconciledCount++;
          results.push({
            paymentId: payment.id,
            storeId: payment.store_id,
            resolvedStatus,
          });
        }
      } catch (err) {
        failedCount++;
        results.push({
          paymentId: payment.id,
          storeId: payment.store_id,
          resolvedStatus: "ERROR",
          error: err instanceof Error ? err.message : "Reconciliation error",
        });
      }
    }

    return {
      reconciledCount,
      failedCount,
      payments: results,
    };
  }

  /**
   * Delegates to WebhookRecoveryService to reclaim and process abandoned webhook events.
   */
  async recoverAbandonedWebhooks(
    clientOrDb: Database | DatabaseClient,
    options?: RecoverWebhooksOptions,
  ): Promise<WebhookRecoveryResult> {
    return this.webhookRecovery.recoverAbandonedEvents(clientOrDb, options);
  }
}
