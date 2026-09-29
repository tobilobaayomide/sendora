"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Transfer = {
  filename: string;
  size: number;
  expiresAt: string;
  maxDownloads: number;
  downloadCount: number;
};

type PageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; transfer: Transfer };

function stateMessage(status: number) {
  if (status === 404) return "Transfer not found.";
  if (status === 409) return "This transfer is not ready yet.";
  if (status === 410) return "This transfer is no longer available.";
  return "Unable to load this transfer. Please try again later.";
}

function isTransfer(value: unknown): value is Transfer {
  return typeof value === "object" && value !== null &&
    "filename" in value && typeof value.filename === "string" &&
    "size" in value && typeof value.size === "number" && Number.isSafeInteger(value.size) && value.size > 0 &&
    "expiresAt" in value && typeof value.expiresAt === "string" && Number.isFinite(Date.parse(value.expiresAt)) &&
    "maxDownloads" in value && typeof value.maxDownloads === "number" && Number.isInteger(value.maxDownloads) && value.maxDownloads > 0 &&
    "downloadCount" in value && typeof value.downloadCount === "number" && Number.isInteger(value.downloadCount) && value.downloadCount >= 0;
}

function formatSize(bytes: number) {
  const units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function RecipientPage({ slug }: { slug: string }) {
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const admissionInFlight = useRef(false);
  const endpoint = `http://localhost:4000/transfers/${encodeURIComponent(slug)}`;

  useEffect(() => {
    const controller = new AbortController();

    async function loadTransfer() {
      try {
        const response = await fetch(endpoint, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) {
          if (!controller.signal.aborted) {
            setState({ status: "error", message: stateMessage(response.status) });
          }
          return;
        }

        const data: unknown = await response.json();
        if (!isTransfer(data)) throw new Error("Invalid metadata response");
        if (!controller.signal.aborted) setState({ status: "ready", transfer: data });
      } catch {
        if (!controller.signal.aborted) {
          setState({ status: "error", message: stateMessage(500) });
        }
      }
    }

    void loadTransfer();
    return () => controller.abort();
  }, [endpoint]);

  async function handleDownload() {
    if (admissionInFlight.current || state.status !== "ready" ||
        state.transfer.downloadCount >= state.transfer.maxDownloads) return;

    admissionInFlight.current = true;
    setIsDownloading(true);
    setDownloadError("");

    try {
      const response = await fetch(`${endpoint}/download`, { method: "POST" });
      if (!response.ok) {
        if ([404, 409, 410].includes(response.status)) {
          setState({ status: "error", message: stateMessage(response.status) });
          return;
        }
        throw new Error("Download admission failed");
      }

      // A successful admission consumes a slot, even if navigation later fails.
      setState((current) => current.status === "ready" ? {
        status: "ready",
        transfer: { ...current.transfer, downloadCount: current.transfer.downloadCount + 1 },
      } : current);

      const data: unknown = await response.json();
      if (typeof data !== "object" || data === null ||
          !("downloadUrl" in data) || typeof data.downloadUrl !== "string" ||
          new URL(data.downloadUrl).protocol !== "https:") {
        throw new Error("Invalid download response");
      }

      window.location.assign(data.downloadUrl);
    } catch {
      setDownloadError("Unable to start the download. Please try again later.");
    } finally {
      admissionInFlight.current = false;
      setIsDownloading(false);
    }
  }

  return (
    <main className="space-y-4 p-6">
      <h1>Download transfer</h1>
      {state.status === "loading" && <p role="status">Loading transfer…</p>}
      {state.status === "error" && <p role="alert">{state.message}</p>}
      {state.status === "ready" && (
        <>
          <dl>
            <dt>Filename</dt>
            <dd>{state.transfer.filename}</dd>
            <dt>Size</dt>
            <dd>{formatSize(state.transfer.size)}</dd>
            <dt>Expires</dt>
            <dd><time dateTime={state.transfer.expiresAt}>{new Date(state.transfer.expiresAt).toLocaleString()}</time></dd>
            <dt>Remaining downloads</dt>
            <dd aria-live="polite">{Math.max(0, state.transfer.maxDownloads - state.transfer.downloadCount)}</dd>
          </dl>
          <button
            type="button"
            className="border px-3 py-1 disabled:opacity-50"
            disabled={isDownloading || state.transfer.downloadCount >= state.transfer.maxDownloads}
            onClick={handleDownload}
          >
            {isDownloading ? "Preparing download…" : "Download"}
          </button>
          {downloadError && <p role="alert">{downloadError}</p>}
        </>
      )}
    </main>
  );
}

export default function Page() {
  const { slug } = useParams<{ slug: string }>();
  return <RecipientPage key={slug} slug={slug} />;
}
