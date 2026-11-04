import type { Database } from "@calcart/db";

export interface OperationalIncident {
  id: string;
  title: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  category: "PAYMENT" | "WORKER" | "NOTIFICATION" | "SECURITY" | "DATABASE";
  description: string;
  affectedCount: number;
  sampleEntityId?: string | null;
  detectedAt: string;
  recommendedAction: string;
}

export interface SystemHealthOverview {
  database: {
    status: "CONNECTED" | "ERROR";
    activeConnections: number;
    latencyMs: number;
  };
  worker: {
    status: "HEALTHY" | "DEGRADED" | "NEEDS_ATTENTION";
    notificationBacklog: number;
    failedNotifications: number;
    failedWebhooks: number;
    pendingWebhooks: number;
    orphanedCapturedPayments: number;
    stuckRefunds: number;
    expiredReservations: number;
  };
  incidents: OperationalIncident[];
}

export class PlatformSystemHealthService {
  constructor(private readonly db: Database) {}

  async getHealthAndIncidents(): Promise<SystemHealthOverview> {
    const startTime = performance.now();
    let dbStatus: "CONNECTED" | "ERROR" = "CONNECTED";

    try {
      await this.db.query("SELECT 1");
    } catch {
      dbStatus = "ERROR";
    }
    const latencyMs = Math.round(performance.now() - startTime);

    // Collect queues and pipeline metrics
    const statsRes = await this.db.query<{
      notification_backlog: string;
      failed_notifications: string;
      failed_webhooks: string;
      pending_webhooks: string;
      orphaned_payments: string;
      stuck_refunds: string;
      expired_reservations: string;
    }>(`
      SELECT
        (SELECT COUNT(*)::text FROM notification_outbox WHERE status = 'PENDING') AS notification_backlog,
        (SELECT COUNT(*)::text FROM notification_outbox WHERE status = 'FAILED') AS failed_notifications,
        (SELECT COUNT(*)::text FROM payment_webhook_events WHERE status = 'FAILED') AS failed_webhooks,
        (SELECT COUNT(*)::text FROM payment_webhook_events WHERE status = 'PENDING') AS pending_webhooks,
        (SELECT COUNT(*)::text FROM payments WHERE status = 'CAPTURED' AND order_id IS NULL) AS orphaned_payments,
        (SELECT COUNT(*)::text FROM refunds WHERE status IN ('PENDING', 'PROCESSING') AND created_at < NOW() - INTERVAL '15 minutes') AS stuck_refunds,
        (SELECT COUNT(*)::text FROM inventory_reservations WHERE status = 'PENDING' AND expires_at < NOW()) AS expired_reservations
    `);

    const s = statsRes.rows[0] || {
      notification_backlog: "0",
      failed_notifications: "0",
      failed_webhooks: "0",
      pending_webhooks: "0",
      orphaned_payments: "0",
      stuck_refunds: "0",
      expired_reservations: "0",
    };

    const notificationBacklog = parseInt(s.notification_backlog, 10);
    const failedNotifications = parseInt(s.failed_notifications, 10);
    const failedWebhooks = parseInt(s.failed_webhooks, 10);
    const pendingWebhooks = parseInt(s.pending_webhooks, 10);
    const orphanedPayments = parseInt(s.orphaned_payments, 10);
    const stuckRefunds = parseInt(s.stuck_refunds, 10);
    const expiredReservations = parseInt(s.expired_reservations, 10);

    const incidents: OperationalIncident[] = [];
    const nowIso = new Date().toISOString();

    // 1. Critical: Orphaned captured payments
    if (orphanedPayments > 0) {
      incidents.push({
        id: "inc-payment-captured-without-order",
        title: "Captured Payments Missing Order Records",
        severity: "CRITICAL",
        category: "PAYMENT",
        description: `${orphanedPayments} captured transaction(s) exist in database without an associated order record. Customer funds were charged without order confirmation.`,
        affectedCount: orphanedPayments,
        detectedAt: nowIso,
        recommendedAction: "Execute PaymentRecoveryJob or inspect Payment Operations Console to confirm or reconcile order state.",
      });
    }

    // 2. High: Stuck refunds
    if (stuckRefunds > 0) {
      incidents.push({
        id: "inc-refunds-stuck-processing",
        title: "Refunds Stuck in Processing State",
        severity: "HIGH",
        category: "PAYMENT",
        description: `${stuckRefunds} refund(s) have remained in PENDING or PROCESSING state for more than 15 minutes.`,
        affectedCount: stuckRefunds,
        detectedAt: nowIso,
        recommendedAction: "Verify Razorpay dashboard for provider refund confirmation and review gateway timeout logs.",
      });
    }

    // 3. High: Failed webhooks
    if (failedWebhooks > 0) {
      incidents.push({
        id: "inc-failed-webhooks",
        title: "Payment Webhook Processing Failures",
        severity: "HIGH",
        category: "WORKER",
        description: `${failedWebhooks} incoming payment webhook events encountered processing errors and reached maximum retry threshold.`,
        affectedCount: failedWebhooks,
        detectedAt: nowIso,
        recommendedAction: "Run WebhookRecoveryJob and inspect error details in Payment Webhook Logs.",
      });
    }

    // 4. Medium: Failed notifications
    if (failedNotifications > 0) {
      incidents.push({
        id: "inc-failed-notifications",
        title: "Notification Outbox Delivery Failures",
        severity: "MEDIUM",
        category: "NOTIFICATION",
        description: `${failedNotifications} transactional email message(s) failed delivery through the notification dispatcher.`,
        affectedCount: failedNotifications,
        detectedAt: nowIso,
        recommendedAction: "Verify SMTP / Resend configuration in platform settings and check email provider status.",
      });
    }

    // 5. Low: Expired reservations backlog
    if (expiredReservations > 10) {
      incidents.push({
        id: "inc-expired-reservations",
        title: "Expired Inventory Reservations Unreclaimed",
        severity: "LOW",
        category: "WORKER",
        description: `${expiredReservations} checkout inventory reservations have passed expiration without being reclaimed.`,
        affectedCount: expiredReservations,
        detectedAt: nowIso,
        recommendedAction: "Trigger InventoryExpirationRecoveryJob to release reserved quantities back to available stock.",
      });
    }

    let workerStatus: "HEALTHY" | "DEGRADED" | "NEEDS_ATTENTION" = "HEALTHY";
    if (orphanedPayments > 5 || failedWebhooks > 10 || notificationBacklog > 50) {
      workerStatus = "NEEDS_ATTENTION";
    } else if (orphanedPayments > 0 || failedWebhooks > 0 || stuckRefunds > 0) {
      workerStatus = "DEGRADED";
    }

    return {
      database: {
        status: dbStatus,
        activeConnections: 5,
        latencyMs,
      },
      worker: {
        status: workerStatus,
        notificationBacklog,
        failedNotifications,
        failedWebhooks,
        pendingWebhooks,
        orphanedCapturedPayments: orphanedPayments,
        stuckRefunds,
        expiredReservations,
      },
      incidents,
    };
  }
}
