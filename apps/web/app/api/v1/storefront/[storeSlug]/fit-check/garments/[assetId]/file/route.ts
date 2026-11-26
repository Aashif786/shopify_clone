import { GarmentAssetService } from "@calcart/products";
import { StoreService, StoreTypeService } from "@calcart/stores";
import { readGarmentFile } from "@/lib/garment-storage";
import { resolveRequestContext } from "@/lib/api";

const storeService = new StoreService();
const storeTypeService = new StoreTypeService();
const garmentService = new GarmentAssetService();

interface RouteContext {
  params: Promise<{ storeSlug: string; assetId: string }>;
}

const notFound = () => new Response("Not found", { status: 404 });

/** Serves a garment GLB only while Fit Check is active and the asset, product and variant are live. */
export async function GET(req: Request, context: RouteContext) {
  try {
    const ctx = await resolveRequestContext(req);
    const { storeSlug, assetId } = await Promise.resolve(context.params);
    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);
    if (store.status !== "ACTIVE" || !(await storeTypeService.isFitCheckActive(ctx.db, store.id))) {
      return notFound();
    }
    const fileName = await garmentService.getStorefrontFileName(ctx.db, store.id, assetId);
    if (!fileName) return notFound();
    const buffer = await readGarmentFile(store.id, fileName);
    if (!buffer) return notFound();

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "model/gltf-binary",
        "Content-Length": String(buffer.length),
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return notFound();
  }
}
