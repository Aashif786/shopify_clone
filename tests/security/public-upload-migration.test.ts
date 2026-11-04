import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { migratePublicUploads } from "../../apps/web/src/lib/public-upload-migration.js";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const STORE_ID = "11111111-1111-7111-8111-111111111111";

let webRoot = "";

afterEach(async () => {
  if (webRoot) {
    await fs.promises.rm(webRoot, { recursive: true, force: true });
    webRoot = "";
  }
});

async function fixture(): Promise<string> {
  webRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), "calcart-uploads-"));
  return webRoot;
}

async function writePublic(root: string, storeId: string, filename: string, body: Buffer): Promise<string> {
  const file = path.join(root, "public", "uploads", "stores", storeId, filename);
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  await fs.promises.writeFile(file, body);
  return file;
}

describe("public upload migration", () => {
  it("moves a raster image into private storage and removes the public copy", async () => {
    const root = await fixture();
    await writePublic(root, STORE_ID, "img_abcd_photo.png", PNG);

    const first = await migratePublicUploads(root);
    expect(first.imagesKept).toBe(1);
    expect(first.publicRemoved).toBe(1);
    const stored = path.join(root, "storage", "uploads", "stores", STORE_ID, "img_abcd_photo.png");
    expect(fs.readFileSync(stored).equals(PNG)).toBe(true);
    expect(
      fs.existsSync(path.join(root, "public", "uploads", "stores", STORE_ID, "img_abcd_photo.png")),
    ).toBe(false);

    const second = await migratePublicUploads(root);
    expect(second).toEqual({
      imagesKept: 0,
      quarantined: 0,
      publicRemoved: 0,
      skipped: 0,
      conflicts: 0,
    });
    expect(fs.readFileSync(stored).equals(PNG)).toBe(true);
  });

  it("quarantines active and unsupported files instead of serving them", async () => {
    const root = await fixture();
    const svg = Buffer.from("<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>");
    await writePublic(root, STORE_ID, "logo.svg", svg);
    await writePublic(root, STORE_ID, "notes.png", Buffer.from("not-a-png"));
    const storageCopy = path.join(root, "storage", "uploads", "stores", STORE_ID, "notes.png");
    await fs.promises.mkdir(path.dirname(storageCopy), { recursive: true });
    await fs.promises.writeFile(storageCopy, Buffer.from("not-a-png"));

    const result = await migratePublicUploads(root);
    expect(result.quarantined).toBe(2);
    expect(result.imagesKept).toBe(0);
    expect(fs.existsSync(path.join(root, "public", "uploads"))).toBe(false);
    expect(fs.existsSync(storageCopy)).toBe(false);
    const quarantine = path.join(root, "storage", "uploads-quarantine", "stores", STORE_ID);
    expect(fs.readFileSync(path.join(quarantine, "logo.svg")).equals(svg)).toBe(true);
    expect(fs.readFileSync(path.join(quarantine, "notes.png")).equals(Buffer.from("not-a-png"))).toBe(true);

    const again = await migratePublicUploads(root);
    expect(again.quarantined).toBe(0);
    expect(fs.readFileSync(path.join(quarantine, "logo.svg")).equals(svg)).toBe(true);
  });

  it("does not overwrite a different private image", async () => {
    const root = await fixture();
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    await writePublic(root, STORE_ID, "img_abcd_photo.jpg", jpeg);
    const stored = path.join(root, "storage", "uploads", "stores", STORE_ID, "img_abcd_photo.jpg");
    await fs.promises.mkdir(path.dirname(stored), { recursive: true });
    await fs.promises.writeFile(stored, Buffer.from([0xff, 0xd8, 0xff, 0x00]));

    const result = await migratePublicUploads(root);
    expect(result.conflicts).toBe(1);
    expect(fs.readFileSync(stored).equals(Buffer.from([0xff, 0xd8, 0xff, 0x00]))).toBe(true);
    expect(
      fs.existsSync(path.join(root, "public", "uploads", "stores", STORE_ID, "img_abcd_photo.jpg")),
    ).toBe(false);
    const quarantined = path.join(
      root,
      "storage",
      "uploads-quarantine",
      "stores",
      STORE_ID,
      "img_abcd_photo.jpg",
    );
    expect(fs.readFileSync(quarantined).equals(jpeg)).toBe(true);
  });
});
