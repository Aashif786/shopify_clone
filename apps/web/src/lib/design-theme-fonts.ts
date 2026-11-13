import {
  Bricolage_Grotesque,
  Cormorant_Garamond,
  Fraunces,
  Inter,
  Jost,
} from "next/font/google";

/**
 * Font families used by the storefront design themes.
 *
 * Only Fraunces (Rustic Heritage's headline face, and the original storefront font) is
 * preloaded. The others set `preload: false`, so a store using Rustic Heritage does not
 * download them; the browser fetches a face only when a theme that uses it is rendered.
 * Each font exposes a CSS variable that the theme tokens reference (see design-themes.ts).
 */
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-atelier-serif",
  axes: ["opsz"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-ds-inter",
  display: "swap",
  preload: false,
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-ds-cormorant",
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
});

const jost = Jost({
  subsets: ["latin"],
  variable: "--font-ds-jost",
  weight: ["300", "400", "500"],
  display: "swap",
  preload: false,
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-ds-bricolage",
  display: "swap",
  preload: false,
});

/** Class names that define every design-theme font variable. Put on any storefront root. */
export const designThemeFontClassName = [
  fraunces.variable,
  inter.variable,
  cormorant.variable,
  jost.variable,
  bricolage.variable,
].join(" ");
