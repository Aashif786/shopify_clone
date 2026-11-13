import { ProductService } from "@calcart/products";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiKey } from "@/lib/api/public-auth";
import { getDb } from "@/lib/db";

const productService = new ProductService();

interface RouteContext {
  params: Promise<{ productId: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  try {
    const { storeId } = await requireApiKey(req, "read:products");
    const { productId } = await Promise.resolve(context.params);
    const db = getDb();

    const product = await productService.getProductById(db, storeId, productId);
    return apiSuccess(product);
  } catch (error) {
    return handleApiError(error);
  }
}
