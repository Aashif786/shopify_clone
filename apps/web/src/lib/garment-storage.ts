import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const MAX_GARMENT_BYTES = 15 * 1024 * 1024;

const STORE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GARMENT_FILE_PATTERN = /^garment_[0-9a-f]{16}\.glb$/;

function garmentDirectory(storeId: string): string | null {
  if (!STORE_ID_PATTERN.test(storeId)) return null;
  const cwd = process.cwd();
  const base = fs.existsSync(path.join(cwd, "apps", "web")) ? path.join(cwd, "apps", "web") : cwd;
  return path.join(base, "storage", "uploads", "stores", storeId, "garments");
}

export class GarmentStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GarmentStorageError";
  }
}

/** Stores an already-validated GLB under a server-generated name; the client name is never used on disk. */
export async function saveGarmentFile(
  storeId: string,
  buffer: Buffer,
): Promise<{ fileName: string; sha256: string }> {
  const dir = garmentDirectory(storeId);
  if (!dir) throw new GarmentStorageError("The garment could not be stored.");
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  const fileName = `garment_${crypto.randomBytes(8).toString("hex")}.glb`;
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(path.join(dir, fileName), buffer);
  return { fileName, sha256 };
}

export async function readGarmentFile(storeId: string, fileName: string): Promise<Buffer | null> {
  const dir = garmentDirectory(storeId);
  if (!dir || !GARMENT_FILE_PATTERN.test(fileName)) return null;
  try {
    return await fs.promises.readFile(path.join(dir, fileName));
  } catch {
    return null;
  }
}

export async function removeGarmentFile(storeId: string, fileName: string | null): Promise<void> {
  const dir = garmentDirectory(storeId);
  if (!dir || !fileName || !GARMENT_FILE_PATTERN.test(fileName)) return;
  await fs.promises.rm(path.join(dir, fileName), { force: true });
}
