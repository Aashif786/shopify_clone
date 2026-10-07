import { getServerConfig } from "@shopify-clone/config";
import { createDatabase } from "@shopify-clone/db";

export async function startWorker(): Promise<void> {
  const config = getServerConfig();
  const database = createDatabase(config.database);

  const health = await database.healthCheck();
  if (!health.ok) {
    await database.close();
    throw new Error("Database is unavailable");
  }

  console.log(`Worker initialized in ${config.app.env} environment`);
}

if (process.env.NODE_ENV !== "test") {
  void startWorker().catch(() => {
    process.stderr.write("Worker failed to start.\n");
    process.exit(1);
  });
}
