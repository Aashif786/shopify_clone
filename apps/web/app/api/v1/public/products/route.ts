import { ProductService } from "@calcart/products";
import {
  apiSuccess,
  createProductValidator,
  handleApiError,
  listProductsQueryValidator,
  validateBody,
  validateQuery,
} from "@/lib/api";
import { requireApiKey } from "@/lib/api/public-auth";
import { getDb } from "@/lib/db";

const productService = new ProductService();

export async function GET(req: Request) {
  try {
    const { storeId } = await requireApiKey(req, "read:products");
    const db = getDb();
    const query = validateQuery(req, listProductsQueryValidator);

    const result = await productService.listProducts(db, storeId, query);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const { storeId } = await requireApiKey(req, "write:products");
    const db = getDb();
    const body = await validateBody(req, createProductValidator);

    const created = await productService.createProduct(db, storeId, body);
    return apiSuccess(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
