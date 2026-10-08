import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@shopify-clone/auth": path.resolve(
        __dirname,
        "./packages/auth/src/index.ts",
      ),
      "@shopify-clone/config": path.resolve(
        __dirname,
        "./packages/config/src/index.ts",
      ),
      "@shopify-clone/db": path.resolve(
        __dirname,
        "./packages/db/src/index.ts",
      ),
      "@shopify-clone/event-bus": path.resolve(
        __dirname,
        "./packages/event-bus/src/index.ts",
      ),
      "@shopify-clone/products": path.resolve(
        __dirname,
        "./modules/products/src/index.ts",
      ),
      "@shopify-clone/stores": path.resolve(
        __dirname,
        "./modules/stores/src/index.ts",
      ),
      "@shopify-clone/tenant": path.resolve(
        __dirname,
        "./packages/tenant/src/index.ts",
      ),
      "@shopify-clone/types": path.resolve(
        __dirname,
        "./packages/types/src/index.ts",
      ),
      "@shopify-clone/ui": path.resolve(
        __dirname,
        "./packages/ui/src/index.ts",
      ),
      "@shopify-clone/validation": path.resolve(
        __dirname,
        "./packages/validation/src/index.ts",
      ),
      "@": path.resolve(__dirname, "./apps/web/src"),
    },
  },
  test: {
    environment: "node",
  },
});
