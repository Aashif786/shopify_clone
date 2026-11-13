/**
 * Test-only stand-in for `next/font/google`.
 *
 * Real font loaders are compiled away by Next's SWC plugin at build time and throw if
 * called at runtime, which would stop any unit test that imports a storefront component
 * using them. Each loader here returns the same shape (`variable`, `className`) so
 * components render normally in vitest.
 */
function loader(options?: { variable?: string }) {
  return {
    className: "next-font-stub",
    style: { fontFamily: "stub" },
    variable: options?.variable ? `font-var${options.variable.replace(/^-+/, "-")}` : "font-var-stub",
  };
}

export const Fraunces = loader;
export const Inter = loader;
export const Cormorant_Garamond = loader;
export const Jost = loader;
export const Bricolage_Grotesque = loader;
