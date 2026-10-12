import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDatabaseConfig } from "@shopify-clone/config";
import { createDatabase } from "./database.js";
import { seedDemo } from "./seed.js";

async function main(): Promise<void> {
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../.env"),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.env"),
  ];

  if (!process.env.DATABASE_URL && typeof process.loadEnvFile === "function") {
    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        try {
          process.loadEnvFile(candidate);
          if (process.env.DATABASE_URL) {
            break;
          }
        } catch {
          // Ignore errors reading local .env
        }
      }
    }
  }

  const config = getDatabaseConfig();
  const db = createDatabase(config);

  try {
    console.log(`Seeding database at ${config.url.replace(/:[^:@]+@/, ":****@")}...`);
    const result = await seedDemo(db);
    console.log(`Demo seed completed successfully!`);
    console.log(`  Store ID:   ${result.storeId}`);
    console.log(`  Store Slug: ${result.storeSlug}`);
    console.log(`  Products:   ${result.productIds.length} seeded`);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

main().catch((err) => {
  console.error("Unexpected error running seed CLI:", err);
  process.exit(1);
});
