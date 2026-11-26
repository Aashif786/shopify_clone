/** Pixel analysis of a product photo, kept free of DOM/canvas APIs so it is unit-testable. */

export interface PixelAnalysis {
  /** Bounding box of the garment in pixel coordinates (x1/y1 exclusive). */
  bbox: { x0: number; y0: number; x1: number; y1: number };
  /** Representative garment colour (per-channel median of garment pixels). */
  dominant: [number, number, number];
  /** Estimated plain background colour, or null when the photo has a transparent background. */
  background: [number, number, number] | null;
  /** True when the photo has transparency that was used to find the garment. */
  hasAlpha: boolean;
  /** 0–1 share of the image that is garment; very low/high values mean the photo is unsuitable. */
  coverage: number;
  /** false when no plain background could be found, so the whole frame was treated as garment. */
  backgroundFound: boolean;
}

const BG_DISTANCE = 30;
const ALPHA_CUTOFF = 40;

type RGB = [number, number, number];

function cornerAverage(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  cx: number,
  cy: number,
  size: number,
): { rgb: RGB; alpha: number } {
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  let n = 0;
  for (let y = cy; y < cy + size && y < h; y++) {
    for (let x = cx; x < cx + size && x < w; x++) {
      const i = (y * w + x) * 4;
      r += data[i]!;
      g += data[i + 1]!;
      b += data[i + 2]!;
      a += data[i + 3]!;
      n++;
    }
  }
  return { rgb: [r / n, g / n, b / n], alpha: a / n };
}

/**
 * Marks background pixels: transparent ones when the photo has an alpha channel, otherwise pixels close
 * to the plain background colour that are *connected to the image border*. Colour-matching pixels
 * enclosed by the garment (white stripes, a white logo) are therefore kept as part of the garment.
 */
function backgroundMask(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  hasAlpha: boolean,
  background: RGB | null,
): Uint8Array {
  const mask = new Uint8Array(w * h);
  if (hasAlpha) {
    for (let p = 0; p < w * h; p++) mask[p] = data[p * 4 + 3]! <= ALPHA_CUTOFF ? 1 : 0;
    return mask;
  }
  if (!background) return mask;
  const near = (p: number): boolean =>
    Math.abs(data[p * 4]! - background[0]) +
      Math.abs(data[p * 4 + 1]! - background[1]) +
      Math.abs(data[p * 4 + 2]! - background[2]) <=
    BG_DISTANCE;

  const stack = new Int32Array(w * h);
  let top = 0;
  const push = (p: number) => {
    if (mask[p] === 0 && near(p)) {
      mask[p] = 1;
      stack[top++] = p;
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + (w - 1));
  }
  while (top > 0) {
    const p = stack[--top]!;
    const x = p % w;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (p >= w) push(p - w);
    if (p < w * (h - 1)) push(p + w);
  }
  return mask;
}

/**
 * Finds the garment in a product photo: via transparency when present, otherwise by assuming a plain
 * background whose colour is read from the four corners.
 */
export function analyzeGarmentPixels(data: Uint8ClampedArray, w: number, h: number): PixelAnalysis {
  const size = Math.max(2, Math.min(8, Math.floor(Math.min(w, h) / 20)));
  const corners = [
    cornerAverage(data, w, h, 0, 0, size),
    cornerAverage(data, w, h, w - size, 0, size),
    cornerAverage(data, w, h, 0, h - size, size),
    cornerAverage(data, w, h, w - size, h - size, size),
  ];

  const hasAlpha = corners.some((c) => c.alpha < 200);
  let background: RGB | null = null;
  let backgroundFound = hasAlpha;
  if (!hasAlpha) {
    const maxSpread = Math.max(
      ...[0, 1, 2].map((ch) => {
        const vals = corners.map((c) => c.rgb[ch]!);
        return Math.max(...vals) - Math.min(...vals);
      }),
    );
    if (maxSpread <= 26) {
      background = [0, 1, 2].map((ch) => corners.reduce((s, c) => s + c.rgb[ch]!, 0) / 4) as RGB;
      backgroundFound = true;
    }
  }

  const bg = backgroundMask(data, w, h, hasAlpha, background);

  let x0 = w;
  let y0 = h;
  let x1 = 0;
  let y1 = 0;
  let count = 0;
  const hist: number[][] = [new Array(256).fill(0), new Array(256).fill(0), new Array(256).fill(0)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (bg[y * w + x] === 1) continue;
      count++;
      if (x < x0) x0 = x;
      if (x >= x1) x1 = x + 1;
      if (y < y0) y0 = y;
      if (y >= y1) y1 = y + 1;
      hist[0]![data[i]!]!++;
      hist[1]![data[i + 1]!]!++;
      hist[2]![data[i + 2]!]!++;
    }
  }

  if (count === 0) {
    return {
      bbox: { x0: 0, y0: 0, x1: w, y1: h },
      dominant: [128, 128, 128],
      background,
      hasAlpha,
      coverage: 0,
      backgroundFound,
    };
  }

  const median = (counts: number[]): number => {
    let acc = 0;
    for (let v = 0; v < 256; v++) {
      acc += counts[v]!;
      if (acc >= count / 2) return v;
    }
    return 128;
  };

  return {
    bbox: { x0, y0, x1, y1 },
    dominant: [median(hist[0]!), median(hist[1]!), median(hist[2]!)],
    background,
    hasAlpha,
    coverage: count / (w * h),
    backgroundFound,
  };
}

/**
 * Builds the pixels used as the garment texture: the photo cropped to the garment, with background
 * pixels (which would otherwise show through gaps such as under the sleeves) replaced by the garment's
 * dominant colour. Returns an RGBA buffer of size `width * height`.
 */
export function composeGarmentPixels(
  data: Uint8ClampedArray,
  w: number,
  analysis: PixelAnalysis,
): { pixels: Uint8ClampedArray; width: number; height: number } {
  const { bbox, dominant, background, hasAlpha } = analysis;
  const height0 = Math.round(data.length / 4 / w);
  const bg = backgroundMask(data, w, height0, hasAlpha, background);
  const width = bbox.x1 - bbox.x0;
  const height = bbox.y1 - bbox.y0;
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = x + bbox.x0;
      const sy = y + bbox.y0;
      const src = (sy * w + sx) * 4;
      const dst = (y * width + x) * 4;
      if (bg[sy * w + sx] === 1) {
        out[dst] = dominant[0];
        out[dst + 1] = dominant[1];
        out[dst + 2] = dominant[2];
      } else {
        out[dst] = data[src]!;
        out[dst + 1] = data[src + 1]!;
        out[dst + 2] = data[src + 2]!;
      }
      out[dst + 3] = 255;
    }
  }
  return { pixels: out, width, height };
}
