import { describe, expect, it } from "vitest";
import {
  generateUuidV7,
  isUuidV7,
  uuidV7Variant,
  uuidV7Version,
} from "@shopify-clone/db";

describe("UUIDv7", () => {
  it("generates a valid UUIDv7 with RFC 4122 variant", () => {
    const id = generateUuidV7();

    expect(isUuidV7(id)).toBe(true);
    expect(uuidV7Version(id)).toBe(7);
    expect(uuidV7Variant(id)).toBe("rfc4122");
    expect(id.charAt(14)).toBe("7");
    expect(["8", "9", "a", "b"]).toContain(id.charAt(19));
  });

  it("generates unique values", () => {
    const ids = new Set<string>();
    for (let index = 0; index < 1_000; index += 1) {
      ids.add(generateUuidV7());
    }

    expect(ids.size).toBe(1_000);
  });
});
