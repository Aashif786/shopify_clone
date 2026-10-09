import { getServerConfig } from "@shopify-clone/config";
import { createDatabase, type Database } from "@shopify-clone/db";
import {
  RazorpayClient,
  RazorpayPaymentProvider,
} from "@shopify-clone/payments";
import { PaymentRecoveryJob } from "./jobs/payments/payment-recovery-job.js";
import { WebhookRecoveryJob } from "./jobs/payments/webhook-recovery-job.js";
import { PaymentRecoveryScheduler } from "./schedulers/payment-recovery-scheduler.js";

export interface WorkerInstance {
  database: Database;
  scheduler: PaymentRecoveryScheduler;
  stop: () => Promise<void>;
}

let activeWorkerInstance: WorkerInstance | null = null;

export async function startWorker(options?: {
  database?: Database;
}): Promise<WorkerInstance> {
  const config = getServerConfig();
  const database = options?.database ?? createDatabase(config.database);

  const health = await database.healthCheck();
  if (!health.ok) {
    if (!options?.database) {
      await database.close();
    }
    throw new Error("Database is unavailable");
  }

  // Optional Razorpay provider initialization if credentials exist
  let provider: RazorpayPaymentProvider | undefined;
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (keyId && keySecret) {
    const client = new RazorpayClient({ keyId, keySecret });
    provider = new RazorpayPaymentProvider({ keyId, keySecret, client });
  }

  const recoveryConfig = config.worker?.paymentRecovery ?? {
    enabled: true,
    pollIntervalMs: 10_000,
    batchSize: 50,
    leaseTimeoutMs: 60_000,
  };

  const paymentJob = new PaymentRecoveryJob(undefined, provider);
  const webhookJob = new WebhookRecoveryJob();

  const scheduler = new PaymentRecoveryScheduler(
    database,
    recoveryConfig,
    paymentJob,
    webhookJob,
  );

  scheduler.start();

  const stop = async (): Promise<void> => {
    await scheduler.stop();
    if (!options?.database) {
      await database.close();
    }
    activeWorkerInstance = null;
  };

  const instance: WorkerInstance = {
    database,
    scheduler,
    stop,
  };

  activeWorkerInstance = instance;
  console.log(`Worker initialized in ${config.app.env} environment`);
  return instance;
}

export async function stopWorker(): Promise<void> {
  if (activeWorkerInstance) {
    await activeWorkerInstance.stop();
    activeWorkerInstance = null;
  }
}

// Process signal registration for standalone execution
if (process.env.NODE_ENV !== "test") {
  const handleShutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down worker gracefully...`);
    try {
      await stopWorker();
      process.exit(0);
    } catch (err) {
      console.error("Error during worker shutdown:", err);
      process.exit(1);
    }
  };

  process.once("SIGINT", () => void handleShutdown("SIGINT"));
  process.once("SIGTERM", () => void handleShutdown("SIGTERM"));

  void startWorker().catch((err) => {
    process.stderr.write(`Worker failed to start: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
