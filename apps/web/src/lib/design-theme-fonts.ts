import {
  Bricolage_Grotesque,
  Cormorant_Garamond,
  Fraunces,
  Fredoka,
  Inter,
  Jost,
  Space_Grotesk,
} from "next/font/google";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-atelier-serif",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-ds-inter",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-ds-cormorant",
  weight: ["400", "600"],
  display: "swap",
});

const jost = Jost({
  subsets: ["latin"],
  variable: "--font-ds-jost",
  weight: ["400", "500"],
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-ds-bricolage",
  display: "swap",
});

const fredoka = Fredoka({
  subsets: ["latin"],
  variable: "--font-ds-fredoka",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-ds-space-grotesk",
  display: "swap",
});

export const designThemeFontClassName = [
  fraunces.variable,
  inter.variable,
  cormorant.variable,
  jost.variable,
  bricolage.variable,
  fredoka.variable,
  spaceGrotesk.variable,
].join(" ");
