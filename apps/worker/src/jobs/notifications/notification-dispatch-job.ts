import {
  type Database,
  NotificationOutboxRepository,
  type NotificationOutboxRow,
} from "@shopify-clone/db";
import {
  EmailService,
  getEmailService,
  type EmailAddress,
  type EmailOrderItem,
  type EmailSendResult,
} from "@shopify-clone/email";

export interface NotificationDispatchJobOptions {
  batchSize?: number;
  asOfDate?: Date;
}

export interface NotificationDispatchJobResult {
  job: "notification-dispatch";
  sentCount: number;
  failedCount: number;
  totalProcessed: number;
  durationMs: number;
  success: boolean;
  processedIds: string[];
  error?: string;
}

const BACKOFF_INTERVALS_MS = [
  60_000,      // Attempt 1 -> 1 min
  300_000,     // Attempt 2 -> 5 min
  900_000,     // Attempt 3 -> 15 min
  1_800_000,   // Attempt 4 -> 30 min
  3_600_000,   // Attempt 5 -> 60 min
];

export class NotificationDispatchJob {
  private readonly outboxRepo: NotificationOutboxRepository;
  private readonly emailService: EmailService;

  constructor(
    emailService?: EmailService,
    outboxRepo?: NotificationOutboxRepository,
  ) {
    this.emailService = emailService ?? getEmailService();
    this.outboxRepo = outboxRepo ?? new NotificationOutboxRepository();
  }

  async run(
    database: Database,
    options?: NotificationDispatchJobOptions,
  ): Promise<NotificationDispatchJobResult> {
    const startTime = Date.now();
    const batchSize = Math.max(1, options?.batchSize ?? 50);
    const asOfDate = options?.asOfDate ?? new Date();

    let sentCount = 0;
    let failedCount = 0;
    const processedIds: string[] = [];

    try {
      // 1. Claim pending notifications due for delivery with SKIP LOCKED
      // Concurrency safe: multiple workers never process the same row simultaneously
      const pendingRows = await this.outboxRepo.claimPending(database, {
        limit: batchSize,
        asOf: asOfDate,
      });

      if (pendingRows.length === 0) {
        return {
          job: "notification-dispatch",
          sentCount: 0,
          failedCount: 0,
          totalProcessed: 0,
          durationMs: Date.now() - startTime,
          success: true,
          processedIds: [],
        };
      }

      // 2. Process each claimed notification entry
      for (const row of pendingRows) {
        processedIds.push(row.id);
        const outcome = await this.processRow(database, row);
        if (outcome.success) {
          sentCount++;
        } else {
          failedCount++;
        }
      }

      const durationMs = Date.now() - startTime;
      console.log(
        `[NotificationDispatchJob] Processed ${pendingRows.length} notifications (${sentCount} sent, ${failedCount} failed) in ${durationMs}ms`,
      );

      return {
        job: "notification-dispatch",
        sentCount,
        failedCount,
        totalProcessed: pendingRows.length,
        durationMs,
        success: failedCount === 0,
        processedIds,
      };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const errorMsg =
        err instanceof Error ? err.message : "Notification dispatch job execution error";
      console.error("[NotificationDispatchJob] Fatal execution error:", err);

      return {
        job: "notification-dispatch",
        sentCount,
        failedCount,
        totalProcessed: processedIds.length,
        durationMs,
        success: false,
        processedIds,
        error: errorMsg,
      };
    }
  }

  private async processRow(
    database: Database,
    row: NotificationOutboxRow,
  ): Promise<{ success: boolean; error?: string }> {
    const rawEmail = row.recipient_email?.trim();

    // Validate recipient email address
    if (!rawEmail || !rawEmail.includes("@") || rawEmail.length < 5) {
      const terminalReason = "Recipient email address is missing or invalid";
      await this.outboxRepo.recordAttemptFailure(
        database,
        row.id,
        terminalReason,
        null,
        true, // Terminal: do not retry invalid email addresses
      );
      return { success: false, error: terminalReason };
    }

    try {
      const sendResult = await this.dispatchByNotificationType(row, rawEmail);

      if (sendResult.success) {
        await this.outboxRepo.markSent(database, row.id);
        return { success: true };
      }

      // Transient provider failure
      const errorMsg = sendResult.error || "Email delivery failed with unknown provider error";
      await this.handleFailure(database, row, errorMsg);
      return { success: false, error: errorMsg };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await this.handleFailure(database, row, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  private async dispatchByNotificationType(
    row: NotificationOutboxRow,
    recipientEmail: string,
  ): Promise<EmailSendResult> {
    const p = (row.payload ?? {}) as Record<string, unknown>;

    switch (row.notification_type) {
      case "ORDER_CONFIRMATION":
        return this.emailService.sendOrderConfirmation({
          to: recipientEmail,
          storeName: (p.storeName as string) || "Store",
          storeSlug: (p.storeSlug as string) || "",
          orderNumber: (p.orderNumber as string) || row.reference_id,
          orderId: (p.orderId as string) || row.reference_id,
          orderDate: (p.orderDate as string | Date) || row.created_at,
          recipientName: (p.recipientName as string) || undefined,
          currency: (p.currency as string) || "USD",
          items: (p.items as EmailOrderItem[]) || [],
          subtotal: (p.subtotal as number) ?? 0,
          discountTotal: (p.discountTotal as number) ?? 0,
          shippingTotal: (p.shippingTotal as number) ?? 0,
          taxTotal: (p.taxTotal as number) ?? 0,
          grandTotal: (p.grandTotal as number) ?? 0,
          shippingAddress: (p.shippingAddress as EmailAddress) || null,
        });

      case "ORDER_FULFILLMENT":
        return this.emailService.sendOrderFulfillment({
          to: recipientEmail,
          storeName: (p.storeName as string) || "Store",
          storeSlug: (p.storeSlug as string) || "",
          orderNumber: (p.orderNumber as string) || row.reference_id,
          orderId: (p.orderId as string) || row.reference_id,
          recipientName: (p.recipientName as string) || undefined,
          fulfillmentStatus: (p.fulfillmentStatus as string) || "FULFILLED",
          carrier: (p.carrier as string) || null,
          trackingNumber: (p.trackingNumber as string) || null,
          trackingUrl: (p.trackingUrl as string) || null,
          items: (p.items as EmailOrderItem[]) || [],
        });

      case "ORDER_CANCELLED":
        return this.emailService.sendOrderCancelled({
          to: recipientEmail,
          storeName: (p.storeName as string) || "Store",
          storeSlug: (p.storeSlug as string) || "",
          orderNumber: (p.orderNumber as string) || row.reference_id,
          orderId: (p.orderId as string) || row.reference_id,
          recipientName: (p.recipientName as string) || undefined,
          cancelReason: (p.cancelReason as string) || null,
          refundStatus: (p.refundStatus as string) || "NOT_APPLICABLE",
          refundAmount: p.refundAmount as number | undefined,
          currency: (p.currency as string) || "USD",
        });

      case "REFUND_CONFIRMATION":
        return this.emailService.sendRefundConfirmation({
          to: recipientEmail,
          storeName: (p.storeName as string) || "Store",
          storeSlug: (p.storeSlug as string) || "",
          orderNumber: (p.orderNumber as string) || row.reference_id,
          orderId: (p.orderId as string) || row.reference_id,
          refundId: (p.refundId as string) || row.reference_id,
          recipientName: (p.recipientName as string) || undefined,
          amount: (p.amount as number) ?? 0,
          currency: (p.currency as string) || "USD",
          isFullRefund: Boolean(p.isFullRefund),
          reason: (p.reason as string) || null,
        });

      default:
        throw new Error(`Unsupported notification type: ${row.notification_type}`);
    }
  }

  private async handleFailure(
    database: Database,
    row: NotificationOutboxRow,
    errorMessage: string,
  ): Promise<void> {
    const nextAttempt = row.attempts + 1;
    const isTerminal = nextAttempt >= row.max_attempts;

    if (isTerminal) {
      console.warn(
        `[NotificationDispatchJob] Notification ${row.id} exhausted all ${row.max_attempts} attempts. Marking FAILED. Last error: ${errorMessage}`,
      );
      await this.outboxRepo.recordAttemptFailure(
        database,
        row.id,
        errorMessage,
        null,
        true,
      );
    } else {
      const backoffIndex = Math.min(row.attempts, BACKOFF_INTERVALS_MS.length - 1);
      const backoffMs = BACKOFF_INTERVALS_MS[backoffIndex] ?? 60_000;
      const nextRetryAt = new Date(Date.now() + backoffMs);

      console.info(
        `[NotificationDispatchJob] Notification ${row.id} attempt ${nextAttempt}/${row.max_attempts} failed. Retrying at ${nextRetryAt.toISOString()}. Error: ${errorMessage}`,
      );

      await this.outboxRepo.recordAttemptFailure(
        database,
        row.id,
        errorMessage,
        nextRetryAt,
        false,
      );
    }
  }
}
