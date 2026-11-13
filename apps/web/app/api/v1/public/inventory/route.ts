import { InventoryService } from "@calcart/inventory";
import {
  apiSuccess,
  handleApiError,
  inventoryQueryValidator,
  validateQuery,
} from "@/lib/api";
import { requireApiKey } from "@/lib/api/public-auth";
import { getDb } from "@/lib/db";

const inventoryService = new InventoryService();

export async function GET(req: Request) {
  try {
    const { storeId } = await requireApiKey(req, "read:inventory");
    const db = getDb();
    const query = validateQuery(req, inventoryQueryValidator);

    if (query.variantId) {
      const availability = await inventoryService.getAvailability(
        db,
        storeId,
        query.variantId,
      );
      return apiSuccess(availability);
    }

    if (query.itemId) {
      const item = await inventoryService.getInventoryById(
        db,
        storeId,
        query.itemId,
      );
      return apiSuccess(item);
    }

    const inventoryList = await inventoryService.listStoreInventory(db, storeId, {
      limit: query.limit ?? 50,
      offset: 0,
    });

    return apiSuccess(inventoryList);
  } catch (error) {
    return handleApiError(error);
  }
}
