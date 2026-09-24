import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

const SHA256_HEX = /^[0-9a-f]{64}$/i;

export function normalizeCvContentDigest(value: unknown) {
  if (typeof value !== "string" || !SHA256_HEX.test(value)) return null;
  return value.toLowerCase();
}

export function cvContentDigest(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function cvContentDigestMatches(
  bytes: Uint8Array,
  claimedDigest: unknown,
) {
  const claimed = normalizeCvContentDigest(claimedDigest);
  if (!claimed) return false;
  return timingSafeEqual(
    Buffer.from(cvContentDigest(bytes), "hex"),
    Buffer.from(claimed, "hex"),
  );
}
