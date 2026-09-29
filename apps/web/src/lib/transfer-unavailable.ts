export type TransferUnavailableReason = "expired" | "revoked" | "download_limit_reached";
export type TransferErrorReason = TransferUnavailableReason | "missing" | "pending" | "unavailable" | "connection";

export async function transferErrorReason(response: Response): Promise<TransferErrorReason> {
  if (response.status === 404) return "missing";
  if (response.status === 409) return "pending";
  if (response.status !== 410) return "connection";

  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "reason" in body) {
      if (body.reason === "expired" || body.reason === "revoked" || body.reason === "download_limit_reached") {
        return body.reason;
      }
    }
  } catch {
    // Older servers or malformed error bodies must not imply a specific cause.
  }
  return "unavailable";
}
