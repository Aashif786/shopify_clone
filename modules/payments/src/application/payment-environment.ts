/**
 * Production and staging never run mock payment behaviour.
 * NODE_ENV=production stays protected even when APP_ENV is demo.
 * APP_ENV=staging stays protected even when NODE_ENV is not production.
 */
export function isProtectedPaymentEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    env.NODE_ENV === "production" ||
    env.APP_ENV === "production" ||
    env.APP_ENV === "staging"
  );
}

/**
 * Credential strictness. Staging may use Razorpay test keys.
 * Demo may use test keys only when the process is not a production runtime.
 */
export function isProductionEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.APP_ENV === "staging") return false;
  if (env.APP_ENV === "demo" && env.NODE_ENV !== "production") return false;
  return env.APP_ENV === "production" || env.NODE_ENV === "production";
}

/** Demo and local/test processes. Never true in production or staging. */
export function isTestOrDemoEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (isProtectedPaymentEnvironment(env)) return false;
  return (
    env.NODE_ENV === "test" ||
    env.VITEST !== undefined ||
    env.APP_ENV === "development" ||
    env.APP_ENV === "demo"
  );
}

/**
 * Fabricated Razorpay HTTP responses, including order_mock_ ids.
 * MOCK_PAYMENTS cannot enable this in production or staging.
 */
export function isMockPaymentTransportEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (isProtectedPaymentEnvironment(env)) return false;
  return (
    env.MOCK_PAYMENTS === "true" ||
    env.NODE_ENV === "test" ||
    env.VITEST !== undefined
  );
}

/** A missing provider may be treated as a successful refund only outside production and staging. */
export function isSimulatedRefundSuccessAllowed(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return !isProtectedPaymentEnvironment(env);
}
