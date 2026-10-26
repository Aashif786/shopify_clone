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
      "@shopify-clone/customers": path.resolve(
        __dirname,
        "./modules/customers/src/index.ts",
      ),
      "@shopify-clone/carts": path.resolve(
        __dirname,
        "./modules/carts/src/index.ts",
      ),
      "@shopify-clone/checkout": path.resolve(
        __dirname,
        "./modules/checkout/src/index.ts",
      ),
      "@shopify-clone/discounts": path.resolve(
        __dirname,
        "./modules/discounts/src/index.ts",
      ),
      "@shopify-clone/email": path.resolve(
        __dirname,
        "./packages/email/src/index.ts",
      ),
      "@shopify-clone/event-bus": path.resolve(
        __dirname,
        "./packages/event-bus/src/index.ts",
      ),
      "@shopify-clone/inventory": path.resolve(
        __dirname,
        "./modules/inventory/src/index.ts",
      ),
      "@shopify-clone/products/combinations": path.resolve(
        __dirname,
        "./modules/products/src/domain/combinations.ts",
      ),
      "@shopify-clone/products": path.resolve(
        __dirname,
        "./modules/products/src/index.ts",
      ),
      "@shopify-clone/orders": path.resolve(
        __dirname,
        "./modules/orders/src/index.ts",
      ),
      "@shopify-clone/payments": path.resolve(
        __dirname,
        "./modules/payments/src/index.ts",
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
      react: path.resolve(__dirname, "./apps/web/node_modules/react"),
      "react-dom": path.resolve(__dirname, "./apps/web/node_modules/react-dom"),
    },
  },
  test: {
    environment: "node",
    testTimeout: 60000,
    hookTimeout: 30000,
    include: ["tests/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**"],
  },
});
