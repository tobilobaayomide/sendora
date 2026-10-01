import { apiUrl } from "../api-url";
import { transferErrorReason, type TransferErrorReason } from "../transfer-unavailable";

export type CreateTransferInput = {
  filename: string;
  contentType: string;
  size: number;
  expiresInHours: number;
  maxDownloads: number;
};

export type CreatedTransfer = {
  slug: string;
  uploadUrl: string;
  ownerToken: string;
};

export type Transfer = {
  filename: string;
  contentType: string;
  size: number;
  expiresAt: string;
  maxDownloads: number;
  downloadCount: number;
};

export class TransferDomainError extends Error {
  constructor(readonly reason: TransferErrorReason) {
    super(`Transfer unavailable: ${reason}`);
    this.name = "TransferDomainError";
  }
}

export class TransferAuthorizationError extends Error {
  constructor() {
    super("Not authorized to revoke transfer");
    this.name = "TransferAuthorizationError";
  }
}

export type DownloadAdmission = {
  readDownloadUrl(): Promise<string>;
};

function transferUrl(slug: string, action = "") {
  return apiUrl(`/transfers/${encodeURIComponent(slug)}${action}`);
}

function isTransfer(value: unknown): value is Transfer {
  return typeof value === "object" && value !== null &&
    "contentType" in value && typeof value.contentType === "string" &&
    "filename" in value && typeof value.filename === "string" &&
    "size" in value && typeof value.size === "number" && Number.isSafeInteger(value.size) && value.size > 0 &&
    "expiresAt" in value && typeof value.expiresAt === "string" && Number.isFinite(Date.parse(value.expiresAt)) &&
    "maxDownloads" in value && typeof value.maxDownloads === "number" && Number.isInteger(value.maxDownloads) && value.maxDownloads > 0 &&
    "downloadCount" in value && typeof value.downloadCount === "number" && Number.isInteger(value.downloadCount) && value.downloadCount >= 0;
}

function isDownloadUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    const localHttpUrl = url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return url.protocol === "https:" || localHttpUrl;
  } catch {
    return false;
  }
}

export async function getTransfer(slug: string, signal?: AbortSignal): Promise<Transfer> {
  const response = await fetch(transferUrl(slug), { signal, cache: "no-store" });
  if (!response.ok) throw new TransferDomainError(await transferErrorReason(response));

  const data: unknown = await response.json();
  if (!isTransfer(data)) throw new Error("Invalid transfer metadata response");
  return data;
}

export async function requestDownload(slug: string): Promise<DownloadAdmission> {
  const response = await fetch(transferUrl(slug, "/download"), { method: "POST" });
  if (!response.ok) {
    if ([404, 409, 410].includes(response.status)) {
      throw new TransferDomainError(await transferErrorReason(response));
    }
    throw new Error("Download admission failed");
  }

  // Admission already consumes a slot; defer body parsing until the page records that count.
  return {
    async readDownloadUrl() {
      const data: unknown = await response.json();
      const downloadUrl = typeof data === "object" && data !== null &&
        "downloadUrl" in data && isDownloadUrl(data.downloadUrl)
        ? data.downloadUrl
        : null;
      if (!downloadUrl) throw new Error("Invalid download response");
      return downloadUrl;
    },
  };
}

export async function revokeTransfer(slug: string, ownerToken: string): Promise<void> {
  const response = await fetch(transferUrl(slug, "/revoke"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ownerToken }),
  });

  if (response.status === 403) throw new TransferAuthorizationError();
  if (!response.ok) throw new Error("Revocation failed");

  const data: unknown = await response.json();
  if (typeof data !== "object" || data === null ||
      !("status" in data) || data.status !== "revoked" ||
      !("slug" in data) || data.slug !== slug) {
    throw new Error("Invalid revocation response");
  }
}

export async function createTransfer(
  input: CreateTransferInput,
): Promise<CreatedTransfer> {
  const response = await fetch(apiUrl("/uploads/presign"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error("Transfer creation failed.");

  const data: unknown = await response.json();
  if (
    typeof data !== "object" ||
    data === null ||
    !("slug" in data) ||
    typeof data.slug !== "string" ||
    !data.slug ||
    !("uploadUrl" in data) ||
    typeof data.uploadUrl !== "string" ||
    !("ownerToken" in data) ||
    typeof data.ownerToken !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(data.ownerToken)
  )
    throw new Error("Invalid transfer response.");

  return {
    slug: data.slug,
    uploadUrl: data.uploadUrl,
    ownerToken: data.ownerToken,
  };
}

export async function completeTransfer(slug: string): Promise<void> {
  const response = await fetch(
    apiUrl(`/transfers/${encodeURIComponent(slug)}/complete`),
    {
      method: "POST",
    },
  );
  if (!response.ok) throw new Error("Transfer completion failed.");
}
