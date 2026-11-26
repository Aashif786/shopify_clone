import * as THREE from "three";
import { analyzeGarmentPixels, composeGarmentPixels } from "./garment-image";
import type { GarmentSkin } from "./generated-garment";

const MAX_DIMENSION = 1024;
const STRIP_PX = 16;
const cache = new Map<string, Promise<GarmentSkin>>();

export class GarmentTextureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GarmentTextureError";
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Required so the canvas stays readable; same-origin product images satisfy it trivially.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new GarmentTextureError("The product photo could not be loaded."));
    img.src = url;
  });
}

/**
 * Turns a product photo into the garment's skin: crops to the garment, replaces the photo's plain
 * background with the garment colour, appends a flat-colour strip for the back, and uploads it as a
 * texture. Cached by URL so switching back to a product is instant.
 */
export function prepareGarmentSkin(url: string): Promise<GarmentSkin> {
  let pending = cache.get(url);
  if (!pending) {
    pending = build(url).catch((err) => {
      cache.delete(url);
      throw err;
    });
    cache.set(url, pending);
  }
  return pending;
}

async function build(url: string): Promise<GarmentSkin> {
  const img = await loadImage(url);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const source = document.createElement("canvas");
  source.width = w;
  source.height = h;
  const sctx = source.getContext("2d", { willReadFrequently: true });
  if (!sctx) throw new GarmentTextureError("Image processing is not available on this device.");
  sctx.drawImage(img, 0, 0, w, h);

  let imageData: ImageData;
  try {
    imageData = sctx.getImageData(0, 0, w, h);
  } catch {
    throw new GarmentTextureError("The product photo can't be used for try-on.");
  }

  const analysis = analyzeGarmentPixels(imageData.data, w, h);
  const composed = composeGarmentPixels(imageData.data, w, analysis);

  const total = composed.width + STRIP_PX;
  const out = document.createElement("canvas");
  out.width = total;
  out.height = composed.height;
  const octx = out.getContext("2d");
  if (!octx) throw new GarmentTextureError("Image processing is not available on this device.");
  octx.putImageData(new ImageData(composed.pixels as unknown as Uint8ClampedArray<ArrayBuffer>, composed.width, composed.height), 0, 0);
  const [r, g, b] = analysis.dominant;
  octx.fillStyle = `rgb(${r},${g},${b})`;
  octx.fillRect(composed.width, 0, STRIP_PX, composed.height);

  const map = new THREE.CanvasTexture(out);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  map.needsUpdate = true;

  return {
    map,
    frontU: composed.width / total,
    solidU: (composed.width + STRIP_PX / 2) / total,
    color: analysis.dominant,
  };
}
