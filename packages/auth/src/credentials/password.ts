import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = 16384; // N
const SCRYPT_BLOCK_SIZE = 8; // r
const SCRYPT_PARALLELIZATION = 1; // p
const SALT_BYTES = 16;

const SCRYPT_OPTIONS = {
  N: SCRYPT_COST,
  r: SCRYPT_BLOCK_SIZE,
  p: SCRYPT_PARALLELIZATION,
  maxmem: 32 * 1024 * 1024,
};

// Pre-computed hash of a dummy password to ensure constant-time response for nonexistent users
export const DUMMY_PASSWORD_HASH =
  "scrypt:00112233445566778899aabbccddeeff:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function deriveScryptKey(
  password: string,
  salt: Buffer,
  keylen: number
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, keylen, SCRYPT_OPTIONS, (err, derivedKey) => {
      if (err) {
        reject(err);
      } else {
        resolve(derivedKey);
      }
    });
  });
}

/**
 * Hashes a plaintext password using standard scrypt with a cryptographic salt.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derivedKey = await deriveScryptKey(password, salt, SCRYPT_KEYLEN);

  return `scrypt:${salt.toString("hex")}:${derivedKey.toString("hex")}`;
}

/**
 * Verifies a plaintext password against a stored scrypt hash in constant time.
 * Returns false safely if the hash format is invalid or passwords do not match.
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  if (!storedHash || !storedHash.startsWith("scrypt:")) {
    return false;
  }

  const parts = storedHash.split(":");
  if (parts.length !== 3) {
    return false;
  }

  const saltHex = parts[1];
  const expectedKeyHex = parts[2];

  if (!saltHex || !expectedKeyHex) {
    return false;
  }

  try {
    const salt = Buffer.from(saltHex, "hex");
    const expectedKey = Buffer.from(expectedKeyHex, "hex");

    if (salt.length !== SALT_BYTES || expectedKey.length !== SCRYPT_KEYLEN) {
      return false;
    }

    const actualKey = await deriveScryptKey(password, salt, SCRYPT_KEYLEN);

    return timingSafeEqual(expectedKey, actualKey);
  } catch {
    return false;
  }
}
