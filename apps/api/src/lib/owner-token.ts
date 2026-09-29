import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function hashOwnerToken(ownerToken: string): string {
  return createHash("sha256").update(ownerToken, "utf8").digest("hex");
}

export function createOwnerToken() {
  const ownerToken = randomBytes(32).toString("base64url");
  return { ownerToken, ownerTokenHash: hashOwnerToken(ownerToken) };
}

export function verifyOwnerToken(ownerToken: string, storedHash: string | undefined): boolean {
  const validHash = typeof storedHash === "string" && /^[a-f0-9]{64}$/.test(storedHash);
  const expected = validHash ? Buffer.from(storedHash, "hex") : Buffer.alloc(32);
  const actual = Buffer.from(hashOwnerToken(ownerToken), "hex");
  // Compare equal-length digests even when the transfer is missing.
  return timingSafeEqual(actual, expected) && validHash;
}
