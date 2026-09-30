"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { isSendoraBundle } from "@/lib/prepare-upload";
import { FileSummary } from "@/components/file-summary";
import { Icon } from "@/components/icon";
import { getOwnerToken, removeOwnerToken, subscribeToOwnership } from "@/lib/transfer-ownership";

import { transferErrorReason, type TransferErrorReason } from "@/lib/transfer-unavailable";


type Transfer = {
  filename: string;
  contentType: string;
  size: number;
  expiresAt: string;
  maxDownloads: number;
  downloadCount: number;
};

type PageState =
  | { status: "loading" }
  | { status: "error"; reason: TransferErrorReason }
  | { status: "ready"; transfer: Transfer };

const unavailableCopy = {
  expired: {
    title: "This Transfer has Expired",
    description: "The transfer’s expiry time has passed and the file is no longer available.",
    icon: "clock",
  },
  revoked: {
    title: "This Transfer was Revoked",
    description: "The sender has disabled access to this transfer.",
    icon: "lock",
  },
  download_limit_reached: {
    title: "Download Limit Reached",
    description: "This transfer has reached the maximum number of allowed downloads.",
    icon: "arrow-down",
  },
  missing: {
    title: "Transfer not Found",
    description: "Check that you have the full link, or ask the sender for a new one.",
    icon: "file",
  },
  pending: {
    title: "File isn’t ready yet",
    description: "The sender hasn’t finished uploading yet. Give it a moment, then check again.",
    icon: "clock",
  },
  unavailable: {
    title: "This Transfer is no longer available",
    description: "It may have expired, been revoked, or reached its download limit. Ask the sender for a new link.",
    icon: "lock",
  },
  connection: {
    title: "We couldn’t load this transfer",
    description: "Something went wrong. Check your connection and try again.",
    icon: "alert",
  },
} as const;

function isTransfer(value: unknown): value is Transfer {
  return typeof value === "object" && value !== null &&
    "contentType" in value && typeof value.contentType === "string" &&
    "filename" in value && typeof value.filename === "string" &&
    "size" in value && typeof value.size === "number" && Number.isSafeInteger(value.size) && value.size > 0 &&
    "expiresAt" in value && typeof value.expiresAt === "string" && Number.isFinite(Date.parse(value.expiresAt)) &&
    "maxDownloads" in value && typeof value.maxDownloads === "number" && Number.isInteger(value.maxDownloads) && value.maxDownloads > 0 &&
    "downloadCount" in value && typeof value.downloadCount === "number" && Number.isInteger(value.downloadCount) && value.downloadCount >= 0;
}

function RecipientPage({ slug }: { slug: string }) {
  const [state, setState] = useState<PageState>({ status: "loading" });
  const isBundle = state.status === "ready" && isSendoraBundle(state.transfer.filename, state.transfer.contentType);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const admissionInFlight = useRef(false);
  const revokeInFlight = useRef(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const revokeTrigger = useRef<HTMLButtonElement>(null);
  const keepTransferButton = useRef<HTMLButtonElement>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const hasOwnerToken = useSyncExternalStore(
    subscribeToOwnership,
    () => getOwnerToken(slug) !== null,
    () => false,
  );
  // The server snapshot has no owner controls; origin is read only in the browser.
  const shareUrl = hasOwnerToken
    ? `${window.location.origin}/d/${encodeURIComponent(slug)}`
    : "";
  const endpoint = `http://localhost:4000/transfers/${encodeURIComponent(slug)}`;

  useEffect(() => {
    if (copyState !== "copied") return;
    const timeout = setTimeout(() => setCopyState("idle"), 2500);
    return () => clearTimeout(timeout);
  }, [copyState]);

  useEffect(() => {
    if (confirmRevoke) keepTransferButton.current?.focus();
    else revokeTrigger.current?.focus();
  }, [confirmRevoke]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadTransfer() {
      try {
        const response = await fetch(endpoint, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) {
          const reason = await transferErrorReason(response);
          if (!controller.signal.aborted) setState({ status: "error", reason });
          return;
        }

        const data: unknown = await response.json();
        if (!isTransfer(data)) throw new Error("Invalid metadata response");
        if (!controller.signal.aborted) setState({ status: "ready", transfer: data });
      } catch {
        if (!controller.signal.aborted) {
          setState({ status: "error", reason: "connection" });
        }
      }
    }

    void loadTransfer();
    return () => controller.abort();
  }, [endpoint, loadAttempt]);

  async function handleDownload() {
    if (getOwnerToken(slug) !== null || admissionInFlight.current || revokeInFlight.current || state.status !== "ready" ||
        state.transfer.downloadCount >= state.transfer.maxDownloads) return;

    admissionInFlight.current = true;
    setIsDownloading(true);
    setDownloadError("");
    setDownloadStarted(false);

    try {
      const response = await fetch(`${endpoint}/download`, { method: "POST" });
      if (!response.ok) {
        if ([404, 409, 410].includes(response.status)) {
          setState({ status: "error", reason: await transferErrorReason(response) });
          return;
        }
        throw new Error("Download admission failed");
      }

      // A successful admission consumes a slot, even if navigation later fails.
      setState((current) => {
        if (current.status !== "ready") return current;
        const downloadCount = current.transfer.downloadCount + 1;
        return { status: "ready", transfer: { ...current.transfer, downloadCount } };
      });

      const data: unknown = await response.json();
      if (typeof data !== "object" || data === null ||
          !("downloadUrl" in data) || typeof data.downloadUrl !== "string" ||
          new URL(data.downloadUrl).protocol !== "https:") {
        throw new Error("Invalid download response");
      }

      window.location.assign(data.downloadUrl);
      setDownloadStarted(true);
    } catch {
      setDownloadError("Unable to start the download. Please try again later.");
    } finally {
      admissionInFlight.current = false;
      setIsDownloading(false);
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  async function handleRevoke() {
    if (revokeInFlight.current || admissionInFlight.current || (state.status === "error" && state.reason === "revoked")) return;

    const ownerToken = getOwnerToken(slug);
    if (!ownerToken) {
      setRevokeError("This browser can no longer authorize changes to this transfer.");
      return;
    }

    revokeInFlight.current = true;
    setIsRevoking(true);
    setRevokeError("");

    try {
      const response = await fetch(`${endpoint}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerToken }),
      });

      if (response.status === 403) {
        setRevokeError("This browser can no longer authorize changes to this transfer.");
        return;
      }
      if (!response.ok) throw new Error("Revocation failed");

      setState({ status: "error", reason: "revoked" });
      setConfirmRevoke(false);
      setDownloadError("");
      if (!removeOwnerToken(slug)) {
        setRevokeError("Transfer revoked, but this browser could not clear its saved ownership.");
      }
    } catch {
      setRevokeError("Unable to revoke the transfer. Please try again later.");
    } finally {
      revokeInFlight.current = false;
      setIsRevoking(false);
    }
  }

  function reloadTransfer() {
    setState({ status: "loading" });
    setDownloadError("");
    setLoadAttempt((attempt) => attempt + 1);
  }

  const remainingDownloads = state.status === "ready"
    ? Math.max(0, state.transfer.maxDownloads - state.transfer.downloadCount)
    : 0;
  const canManage = hasOwnerToken && (state.status === "ready" ||
    (state.status === "error" && state.reason === "pending"));

  return (
    <main id="main-content" className="
      mx-auto flex w-[calc(100%-40px)] max-w-140 flex-1 flex-col justify-center py-7
      phone:w-[calc(100%-32px)] phone:py-5
    ">


      <section
        className="overflow-hidden rounded-xl border border-border bg-surface shadow-panel"
        aria-label="Transfer details"
      >
      {state.status === "ready" && (
        <header className="px-6 pt-7 pb-2 text-center phone:px-5">
          {hasOwnerToken && <span className="mx-auto mb-3 grid size-12 place-items-center rounded-full border border-success/25 bg-success-soft text-success"><Icon name="check" className="size-6" /></span>}
          <span className={`${hasOwnerToken ? "hidden" : "inline-flex"} items-center gap-1.75 rounded-[5px] px-2.5 py-1.25 text-[12px] font-semibold
            ${!hasOwnerToken && !downloadStarted && remainingDownloads === 0 ? "bg-surface-subtle text-muted-strong" : "bg-success-soft text-success"}`}>
            <Icon className="size-3.75" name={!hasOwnerToken && !downloadStarted && remainingDownloads === 0 ? "lock" : "check"} />
            {hasOwnerToken ? "Ready to Share" : downloadStarted ? "Download started" : remainingDownloads === 0 ? "No downloads remaining" : "Ready to Download"}
          </span>
          <h1 className="
            mt-3 mb-2 font-heading text-[clamp(1.25rem,4vw,1.625rem)] font-semibold
            leading-tight tracking-[-0.055em] text-balance
          ">{hasOwnerToken ? "Your File is Ready" : isBundle ? "You’ve Received Files" : "You’ve Received a File"}</h1>
          <p className="text-[13px] leading-[1.6] text-muted">{hasOwnerToken
            ? "One link. Send it to someone who needs it."
            : isBundle ? "Your files, together in one ZIP archive." : "A file shared with you. Yours to download."}</p>
        </header>
      )}
        {state.status === "loading" && (
          <div className="flex flex-col items-center gap-4 px-7 py-9 text-center phone:px-5 phone:py-7" role="status">
            <span className="mb-1 grid size-12 place-items-center rounded-2xl border border-border bg-surface-subtle text-brand"><span className="
              inline-block size-4.5 shrink-0 rounded-full border-2 border-current border-r-transparent
              animate-spin [animation-duration:850ms] motion-reduce:animate-none
            " /></span>
            <h1 className="
              font-heading text-[clamp(1.375rem,4vw,1.625rem)] font-semibold leading-[1.35]
              tracking-[-0.045em] text-balance
            ">Getting Your Transfer</h1>
            <p className="mt-3 max-w-90 text-[14px] leading-[1.7] text-muted">Just a moment while we check the details.</p>
          </div>
        )}

        {state.status === "error" && (
          <div className="flex flex-col items-center gap-4 px-7 py-9 text-center phone:px-5 phone:py-7">
            <span className="mb-1 grid size-12 place-items-center rounded-2xl border border-border bg-surface-subtle text-brand"><Icon className="size-6" name={unavailableCopy[state.reason].icon} /></span>
            <div role="alert">
              <h1 className="
                font-heading text-[clamp(1.375rem,4vw,1.625rem)] font-semibold leading-[1.35]
                tracking-[-0.045em] text-balance
              ">{unavailableCopy[state.reason].title}</h1>
              <p className="mt-3 max-w-90-[14px] leading-[1.7] text-muted">{hasOwnerToken && state.reason === "pending"
                ? "Your upload hasn’t finished yet. Once it’s complete, your link will be ready to share."
                : unavailableCopy[state.reason].description}</p>
            </div>
            {(state.reason === "pending" || state.reason === "connection") ? (
              <button type="button" className="
                inline-flex items-center justify-center gap-2.5 rounded-lg border font-semibold
                leading-[1.4] text-center no-underline transition-colors duration-150 ease-[ease]
                motion-reduce:transition-none disabled:border-border disabled:bg-surface-subtle
                disabled:text-muted min-h-12 px-5 py-2.75 border-border-strong bg-surface
                text-foreground enabled:hover:bg-surface-subtle mt-2
              " onClick={reloadTransfer}>
                <Icon name="refresh" />
                {state.reason === "pending" ? "Check Again" : "Try Again"}
              </button>
            ) : (
              <Link href="/" className="
                inline-flex items-center justify-center gap-2.5 rounded-lg border font-semibold
                leading-[1.4] text-center no-underline transition-colors duration-150 ease-[ease]
                motion-reduce:transition-none disabled:border-border disabled:bg-surface-subtle
                disabled:text-muted min-h-12 px-5 py-2.75 border-border-strong bg-surface
                text-foreground hover:bg-surface-subtle mt-2
              ">Send a File <Icon name="arrow-right" /></Link>
            )}
          </div>
        )}

        {state.status === "ready" && (
          <>
            {hasOwnerToken && (
              <div className="px-6 py-5 phone:px-5">
                <div className="flex gap-2 phone:flex-col">
                <div className="
                  flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-border-strong bg-surface-subtle
                  px-3.5 focus-within:outline-2 focus-within:outline-offset-3 focus-within:outline-brand
                ">
                  <Icon name="link" className="size-4.25 text-muted" />
                  <input
                    id="public-share-link"
                    className="
                      h-11.5 w-full min-w-0 rounded-none border-0 bg-transparent text-[14px]
                      text-ellipsis font-medium text-foreground outline-none phone:text-[16px]
                    "
                    type="text"
                    value={shareUrl}
                    readOnly
                    spellCheck={false}
                    onFocus={(event) => event.currentTarget.select()}
                    aria-describedby="share-link-description"
                  />
                </div>
                <button type="button" className="
                  inline-flex items-center justify-center gap-2.5 rounded-lg border font-semibold
                  leading-[1.4] text-center no-underline transition-colors duration-150 ease-[ease]
                  motion-reduce:transition-none disabled:border-border disabled:bg-surface-subtle
                  disabled:text-muted min-h-12 px-5 py-2.75 border-transparent bg-action text-on-brand
                  enabled:hover:bg-action-hover enabled:active:brightness-95 shrink-0 text-[13px]
                " onClick={handleCopyLink}>
                  <Icon name={copyState === "copied" ? "check" : "copy"} />
                  {copyState === "copied" ? "Copied" : "Copy Link"}
                </button>
                </div>
                <div aria-live="polite">
                  {copyState === "copied" && <p className="mt-2.5 text-center text-[13px] text-success">Link copied. Ready to share.</p>}
                  {copyState === "error" && (
                    <p className="
                      flex items-start gap-2.5 rounded-lg border border-transparent bg-danger-soft px-4
                      py-3.25 text-[14px] leading-[1.6] text-danger wrap-anywhere mt-4
                    ">Couldn’t copy the link. Select the public link above and copy it manually.</p>
                  )}
                </div>
              </div>
            )}
            <div className={`px-6 pb-5 phone:px-5 ${hasOwnerToken ? "pt-1" : "pt-6"}`}>

              <FileSummary filename={state.transfer.filename} size={state.transfer.size} detail={isBundle ? "ZIP archive" : undefined} variant={hasOwnerToken ? "transfer" : "recipient"} />
            </div>
            <dl className="mx-6 grid grid-cols-[1.4fr_1fr] gap-4 border-y border-border py-4 phone:mx-5 narrow:grid-cols-1 narrow:gap-3">
              <div className="min-w-0">
                <dt className="mb-2 flex items-center gap-1.75 text-[13px] text-muted"><Icon className="size-3.75" name="clock" /> Expires</dt>
                <dd className="text-[14px] font-semibold leading-[1.6] tabular-nums">
                  <time dateTime={state.transfer.expiresAt}>
                    {new Date(state.transfer.expiresAt).toLocaleString(undefined, {
                      month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
                    })}
                  </time>
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="mb-2 flex items-center gap-1.75 text-[13px] text-muted"><Icon className="size-3.75" name="arrow-down" /> {hasOwnerToken ? "Downloads Used" : "Downloads Left"}</dt>
                <dd className="text-[14px] font-semibold leading-[1.6] tabular-nums" aria-live="polite">
                  {hasOwnerToken
                    ? <>{state.transfer.downloadCount} <span className="font-normal text-muted">/ {state.transfer.maxDownloads}</span></>
                    : remainingDownloads}
                </dd>
              </div>
            </dl>

            {!hasOwnerToken && (
              <div className="px-6 py-5 phone:px-5">
                <button
                  type="button"
                  className="
                    inline-flex items-center justify-center gap-2.5 rounded-lg border font-semibold
                    leading-[1.4] text-center no-underline transition-colors duration-150 ease-[ease]
                    motion-reduce:transition-none disabled:border-border disabled:bg-surface-subtle
                    disabled:text-muted min-h-12 px-5 py-2.75 border-transparent bg-action
                    text-on-brand enabled:hover:bg-action-hover enabled:active:brightness-95 w-full
                  "
                  disabled={isDownloading || isRevoking || remainingDownloads === 0}
                  aria-busy={isDownloading}
                  onClick={handleDownload}
                >
                  {isDownloading ? <Icon name="loader" className="size-4.5 animate-spin [animation-duration:850ms] motion-reduce:animate-none" /> : <Icon name="arrow-down" />}
                  {isDownloading ? "Preparing download…" : remainingDownloads === 0 ? (downloadStarted ? "Download started" : "No downloads remaining") : isBundle ? "Download All" : "Download File"}
                </button>
                <p className="mt-3 text-center text-[12px] leading-[1.6] text-muted">{remainingDownloads === 0
                  ? "0 downloads remaining. Another download cannot be started."
                  : "Starting a download uses one of the remaining downloads."}</p>
                {downloadStarted && <p className="mt-2.5 text-center text-[13px] text-success" role="status">Your Download is Starting.</p>}
                {downloadError && <p className="
                  flex items-start gap-2.5 rounded-lg border border-transparent bg-danger-soft px-4
                  py-3.25 text-[14px] leading-[1.6] text-danger wrap-anywhere mt-4
                " role="alert">{downloadError}</p>}
              </div>
            )}
          </>
        )}

        {canManage && (
          <div className="
            flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1 border-t border-border
            bg-surface-subtle px-6 py-3 phone:px-5
          ">
            {confirmRevoke ? (
              <div className="grid w-full gap-4 py-1">
                <div>
                  <h2 className="mb-1.25 font-heading text-[14px] font-semibold">Revoke This Transfer?</h2>
                  <p className="text-[13px] leading-normal text-muted">This stops new downloads. You can’t undo it.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button ref={keepTransferButton} type="button" className="
                    inline-flex items-center justify-center gap-2.5 rounded-lg border font-semibold
                    leading-[1.4] text-center no-underline transition-colors duration-150 ease-[ease]
                    motion-reduce:transition-none disabled:border-border disabled:bg-surface-subtle
                    disabled:text-muted min-h-12 px-5 py-2.75 border-border-strong bg-surface
                    text-foreground enabled:hover:bg-surface-subtle text-[13px] phone:flex-auto
                  " disabled={isRevoking} onClick={() => setConfirmRevoke(false)}>
                    Keep Transfer
                  </button>
                  <button type="button" className="
                    inline-flex items-center justify-center gap-2.5 rounded-lg border font-semibold
                    leading-[1.4] text-center no-underline transition-colors duration-150 ease-[ease]
                    motion-reduce:transition-none disabled:border-border disabled:bg-surface-subtle
                    disabled:text-muted min-h-12 px-5 py-2.75 border-border bg-transparent text-danger
                    enabled:hover:bg-danger-soft enabled:hover:border-danger text-[13px] phone:flex-auto
                  " disabled={isRevoking || isDownloading} aria-busy={isRevoking} onClick={handleRevoke}>
                    {isRevoking ? <Icon name="loader" className="size-4.5 animate-spin [animation-duration:850ms] motion-reduce:animate-none" /> : <Icon name="trash" />}
                    {isRevoking ? "Revoking…" : "Revoke Transfer"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="flex items-center gap-1.75 text-[12px] leading-normal text-muted"><Icon name="shield" className="size-3.5" /> You manage this transfer from this browser.</p>
                <button ref={revokeTrigger} type="button" className="
                  inline-flex items-center justify-center gap-2.5 rounded-lg border font-semibold
                  leading-[1.4] text-center no-underline transition-colors duration-150 ease-[ease]
                  motion-reduce:transition-none disabled:border-border disabled:bg-surface-subtle
                  disabled:text-muted min-h-12 border-transparent bg-transparent px-0 py-2.75
                  text-[13px] text-danger enabled:hover:bg-surface-subtle enabled:hover:text-foreground
                " disabled={isRevoking || isDownloading} onClick={() => setConfirmRevoke(true)}>
                  <Icon name="trash" /> Revoke Transfer
                </button>
              </>
            )}
          </div>
        )}
        {revokeError && <p className="
          flex items-start gap-2.5 rounded-lg border border-transparent bg-danger-soft px-4 py-3.25
          text-[14px] leading-[1.6] text-danger wrap-anywhere mx-6 my-5
        " role="alert">{revokeError}</p>}
      </section>
      {state.status === "ready" && (
        <p className="mt-5.5 flex items-center justify-center gap-1.75 text-center text-[12px] text-muted"><Icon name="lock" className="size-3.5" /> {hasOwnerToken ? "Your ownership stays in this browser." : "No account. Just the file you came for."}</p>
      )}
    </main>
  );
}

export default function Page() {
  const { slug } = useParams<{ slug: string }>();
  return <RecipientPage key={slug} slug={slug} />;
}
