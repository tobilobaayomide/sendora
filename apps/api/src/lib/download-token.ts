import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function hashDownloadToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createDownloadToken() {
  const token = randomBytes(32).toString("base64url");

  return {
    token,
    tokenHash: hashDownloadToken(token),
  };
}

export function verifyDownloadToken(
  token: string,
  storedHash: string | undefined,
): boolean {
  const validHash =
    typeof storedHash === "string" && /^[a-f0-9]{64}$/.test(storedHash);

  const expected = validHash
    ? Buffer.from(storedHash, "hex")
    : Buffer.alloc(32);

  const actual = Buffer.from(hashDownloadToken(token), "hex");

  return timingSafeEqual(actual, expected) && validHash;
}