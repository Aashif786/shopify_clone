export type FontCategory = "sans-serif" | "serif" | "display" | "monospace";

export interface FontDefinition {
  id: string;
  name: string;
  category: FontCategory;
  family: string;
  googleFont: string;
  weights: number[];
  sampleText: string;
  tags: string[];
  isVariable?: boolean;
}

export const FONT_LIBRARY: FontDefinition[] = [
  {
    id: "inter",
    name: "Inter",
    category: "sans-serif",
    family: "var(--font-ds-inter, 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
    googleFont: "Inter:wght@300;400;500;600;700;800",
    weights: [300, 400, 500, 600, 700, 800],
    sampleText: "High-density clean geometric commerce",
    tags: ["modern", "clean", "neutral", "tech", "readable", "versatile"],
  },
  {
    id: "playfair-display",
    name: "Playfair Display",
    category: "serif",
    family: "'Playfair Display', Georgia, Cambria, serif",
    googleFont: "Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;1,400;1,600",
    weights: [400, 600, 700, 800],
    sampleText: "Haute Couture & Curated Luxury",
    tags: ["luxury", "editorial", "high-contrast", "fashion", "headline", "classic"],
  },
  {
    id: "plus-jakarta-sans",
    name: "Plus Jakarta Sans",
    category: "sans-serif",
    family: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    googleFont: "Plus+Jakarta+Sans:wght@400;500;600;700;800",
    weights: [400, 500, 600, 700, 800],
    sampleText: "Modern digital craft and fluid motion",
    tags: ["modern", "tech", "friendly", "geometric", "ui", "contemporary"],
  },
  {
    id: "cinzel",
    name: "Cinzel",
    category: "display",
    family: "'Cinzel', 'Times New Roman', Georgia, serif",
    googleFont: "Cinzel:wght@400;600;700;800",
    weights: [400, 600, 700, 800],
    sampleText: "ROYAL HERITAGE & ARCHIVAL GOODS",
    tags: ["classical", "roman", "luxury", "monumental", "jewelry", "premium"],
  },
  {
    id: "space-grotesk",
    name: "Space Grotesk",
    category: "display",
    family: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
    googleFont: "Space+Grotesk:wght@400;500;600;700",
    weights: [400, 500, 600, 700],
    sampleText: "Next-generation spatial electronics",
    tags: ["tech", "brutalist", "geometric", "cyber", "headline", "bold"],
  },
  {
    id: "lora",
    name: "Lora",
    category: "serif",
    family: "'Lora', Georgia, 'Times New Roman', serif",
    googleFont: "Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500",
    weights: [400, 500, 600, 700],
    sampleText: "Thoughtful stories and organic materials",
    tags: ["literary", "editorial", "warm", "organic", "storytelling", "calligraphy"],
  },
  {
    id: "outfit",
    name: "Outfit",
    category: "sans-serif",
    family: "'Outfit', -apple-system, BlinkMacSystemFont, sans-serif",
    googleFont: "Outfit:wght@300;400;500;600;700;800",
    weights: [300, 400, 500, 600, 700, 800],
    sampleText: "Vibrant lifestyle and everyday essentials",
    tags: ["friendly", "vibrant", "geometric", "clean", "apparel", "modern"],
  },
  {
    id: "cormorant-garamond",
    name: "Cormorant Garamond",
    category: "serif",
    family: "var(--font-ds-cormorant, 'Cormorant Garamond', Garamond, serif)",
    googleFont: "Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400;1,600",
    weights: [300, 400, 500, 600],
    sampleText: "Archival Botanicals & Fine Fragrance",
    tags: ["renaissance", "traditional", "prestigious", "whisper", "delicate", "heritage"],
  },
  {
    id: "jetbrains-mono",
    name: "JetBrains Mono",
    category: "monospace",
    family: "'JetBrains Mono', 'Fira Code', Menlo, monospace",
    googleFont: "JetBrains+Mono:wght@400;500;600;700",
    weights: [400, 500, 600, 700],
    sampleText: "SYS_REQ: 256-bit encryption verified",
    tags: ["technical", "developer", "precise", "code", "cyber", "hardware"],
  },
  {
    id: "bricolage-grotesque",
    name: "Bricolage Grotesque",
    category: "display",
    family: "var(--font-ds-bricolage, 'Bricolage Grotesque', sans-serif)",
    googleFont: "Bricolage+Grotesque:opsz,wght@12..96,400..800",
    weights: [400, 500, 600, 700, 800],
    sampleText: "Distinctive Character & Visual Punch",
    tags: ["expressive", "quirky", "character", "bold", "poster", "contemporary"],
    isVariable: true,
  },
  {
    id: "fraunces",
    name: "Fraunces",
    category: "serif",
    family: "var(--font-atelier-serif, 'Fraunces', Georgia, serif)",
    googleFont: "Fraunces:opsz,wght@9..144,400..800",
    weights: [400, 500, 600, 700, 800],
    sampleText: "Warm Artisanal Handcrafted Goods",
    tags: ["warm", "soft", "artisanal", "retro", "heritage", "cozy"],
    isVariable: true,
  },
  {
    id: "syne",
    name: "Syne",
    category: "display",
    family: "'Syne', -apple-system, BlinkMacSystemFont, sans-serif",
    googleFont: "Syne:wght@500;600;700;800",
    weights: [500, 600, 700, 800],
    sampleText: "AVANT-GARDE DESIGN & CONCEPT STORE",
    tags: ["bold", "fashion", "art", "expressive", "avant-garde", "poster"],
  },
  {
    id: "dm-sans",
    name: "DM Sans",
    category: "sans-serif",
    family: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    googleFont: "DM+Sans:ital,wght@0,400;0,500;0,700;1,400",
    weights: [400, 500, 700],
    sampleText: "Crisp readability across every device",
    tags: ["minimalist", "geometric", "clean", "body", "high-contrast"],
  },
  {
    id: "merriweather",
    name: "Merriweather",
    category: "serif",
    family: "'Merriweather', Georgia, serif",
    googleFont: "Merriweather:ital,wght@0,300;0,400;0,700;1,300",
    weights: [300, 400, 700],
    sampleText: "Pleasant long-form reading experience",
    tags: ["readable", "editorial", "body", "classic", "robust"],
  },
  {
    id: "space-mono",
    name: "Space Mono",
    category: "monospace",
    family: "'Space Mono', monospace",
    googleFont: "Space+Mono:ital,wght@0,400;0,700;1,400",
    weights: [400, 700],
    sampleText: "SERIAL: 8492-AX // LIMITED BATCH",
    tags: ["brutalist", "quirky", "retro", "typewriter", "monospace"],
  },
  {
    id: "montserrat",
    name: "Montserrat",
    category: "sans-serif",
    family: "'Montserrat', -apple-system, BlinkMacSystemFont, sans-serif",
    googleFont: "Montserrat:wght@400;500;600;700;800",
    weights: [400, 500, 600, 700, 800],
    sampleText: "Urban architectural posters and badges",
    tags: ["architectural", "clean", "urban", "modern", "solid"],
  },
];

export const LEGACY_FONT_MAP: Record<string, string> = {
  display: "bricolage-grotesque",
  sans: "inter",
  serif: "fraunces",
  mono: "jetbrains-mono",
};

export function getFontById(id: string | null | undefined): FontDefinition | undefined {
  if (!id) return undefined;
  const canonicalId = LEGACY_FONT_MAP[id] || id;
  return FONT_LIBRARY.find((f) => f.id === canonicalId || f.name.toLowerCase() === canonicalId.toLowerCase());
}

export function resolveFontFamily(idOrName: string | null | undefined, fallback = "sans-serif"): string {
  if (!idOrName) return fallback;
  const font = getFontById(idOrName);
  if (font) return font.family;

  // Check legacy keywords
  if (idOrName === "serif") return "Georgia, 'Times New Roman', serif";
  if (idOrName === "mono") return "'Courier New', Courier, monospace";
  if (idOrName === "display") return "var(--font-display, var(--font-sans, sans-serif))";
  if (idOrName === "sans") return "var(--font-sans, system-ui, sans-serif)";

  return `'${idOrName}', ${fallback}`;
}

export function getGoogleFontsUrl(fontIds: Array<string | null | undefined>): string | null {
  const families: string[] = [];
  const seen = new Set<string>();

  for (const id of fontIds) {
    if (!id) continue;
    const font = getFontById(id);
    if (font && !seen.has(font.id)) {
      seen.add(font.id);
      families.push(`family=${font.googleFont}`);
    }
  }

  if (families.length === 0) return null;
  return `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap`;
}
