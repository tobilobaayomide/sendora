import type { transfers } from "../db/schema";

export type TransferUnavailableReason = "expired" | "revoked" | "download_limit_reached";

type TerminalFields = Pick<typeof transfers.$inferSelect,
  "expiresAt" | "revokedAt" | "exhaustedAt" | "downloadCount" | "maxDownloads">;

export function transferUnavailableReason(
  transfer: TerminalFields,
  now: number,
): TransferUnavailableReason | undefined {
  // Timestamp ties use this stable order: revoked, expired, download limit.
  const events: { reason: TransferUnavailableReason; at: number }[] = [];
  if (transfer.revokedAt !== null) {
    events.push({ reason: "revoked", at: transfer.revokedAt.getTime() });
  }
  if (transfer.expiresAt.getTime() <= now) {
    events.push({ reason: "expired", at: transfer.expiresAt.getTime() });
  }
  const exhausted = transfer.downloadCount >= transfer.maxDownloads;
  if (exhausted && transfer.exhaustedAt !== null) {
    events.push({ reason: "download_limit_reached", at: transfer.exhaustedAt.getTime() });
  }
  // Historical exhaustion without a timestamp cannot be ordered. Prefer a known
  // terminal event; otherwise report the exhausted count. Never invent a date.
  return events.sort((a, b) => a.at - b.at)[0]?.reason ??
    (exhausted ? "download_limit_reached" : undefined);
}
