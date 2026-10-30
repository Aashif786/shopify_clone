import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@calcart/auth": path.resolve(
        __dirname,
        "./packages/auth/src/index.ts",
      ),
      "@calcart/config": path.resolve(
        __dirname,
        "./packages/config/src/index.ts",
      ),
      "@calcart/db": path.resolve(
        __dirname,
        "./packages/db/src/index.ts",
      ),
      "@calcart/customers": path.resolve(
        __dirname,
        "./modules/customers/src/index.ts",
      ),
      "@calcart/carts": path.resolve(
        __dirname,
        "./modules/carts/src/index.ts",
      ),
      "@calcart/checkout": path.resolve(
        __dirname,
        "./modules/checkout/src/index.ts",
      ),
      "@calcart/discounts": path.resolve(
        __dirname,
        "./modules/discounts/src/index.ts",
      ),
      "@calcart/email": path.resolve(
        __dirname,
        "./packages/email/src/index.ts",
      ),
      "@calcart/event-bus": path.resolve(
        __dirname,
        "./packages/event-bus/src/index.ts",
      ),
      "@calcart/inventory": path.resolve(
        __dirname,
        "./modules/inventory/src/index.ts",
      ),
      "@calcart/products/combinations": path.resolve(
        __dirname,
        "./modules/products/src/domain/combinations.ts",
      ),
      "@calcart/products": path.resolve(
        __dirname,
        "./modules/products/src/index.ts",
      ),
      "@calcart/orders": path.resolve(
        __dirname,
        "./modules/orders/src/index.ts",
      ),
      "@calcart/payments": path.resolve(
        __dirname,
        "./modules/payments/src/index.ts",
      ),
      "@calcart/stores/landing-page": path.resolve(
        __dirname,
        "./modules/stores/src/domain/landing-page.ts",
      ),
      "@calcart/stores": path.resolve(
        __dirname,
        "./modules/stores/src/index.ts",
      ),
      "@calcart/tenant": path.resolve(
        __dirname,
        "./packages/tenant/src/index.ts",
      ),
      "@calcart/types": path.resolve(
        __dirname,
        "./packages/types/src/index.ts",
      ),
      "@calcart/ui": path.resolve(
        __dirname,
        "./packages/ui/src/index.ts",
      ),
      "@calcart/validation": path.resolve(
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
