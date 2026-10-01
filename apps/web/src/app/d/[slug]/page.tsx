"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { isSendoraBundle } from "@/lib/prepare-upload";
import { Icon } from "@/components/icon";
import { DownloadControls } from "@/components/transfer/download-controls";
import { ShareLinkControls } from "@/components/transfer/share-link-controls";
import { TransferMetadata } from "@/components/transfer/transfer-metadata";
import { TransferUnavailable } from "@/components/transfer/transfer-unavailable";
import {
  getTransfer,
  requestDownload,
  revokeTransfer,
  TransferAuthorizationError,
  TransferDomainError,
  type Transfer,
} from "@/lib/transfer/api";
import {
  getOwnerToken,
  removeOwnerToken,
  subscribeToOwnership,
} from "@/lib/transfer-ownership";
import type { TransferErrorReason } from "@/lib/transfer-unavailable";

type PageState =
  | { status: "loading" }
  | { status: "error"; reason: TransferErrorReason }
  | { status: "ready"; transfer: Transfer };

function RecipientPage({ slug }: { slug: string }) {
  const [state, setState] = useState<PageState>({ status: "loading" });
  const isBundle =
    state.status === "ready" &&
    isSendoraBundle(state.transfer.filename, state.transfer.contentType);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const admissionInFlight = useRef(false);
  const revokeInFlight = useRef(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const revokeTrigger = useRef<HTMLButtonElement>(null);
  const keepTransferButton = useRef<HTMLButtonElement>(null);
  const revokedHeading = useRef<HTMLHeadingElement>(null);
  const focusRevokedHeadingOnClose = useRef(false);
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

  useEffect(() => {
    if (copyState !== "copied") return;
    const timeout = setTimeout(() => setCopyState("idle"), 2500);
    return () => clearTimeout(timeout);
  }, [copyState]);

  useEffect(() => {
    if (confirmRevoke) keepTransferButton.current?.focus();
    else if (focusRevokedHeadingOnClose.current) {
      focusRevokedHeadingOnClose.current = false;
      revokedHeading.current?.focus();
    } else revokeTrigger.current?.focus();
  }, [confirmRevoke]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadTransfer() {
      try {
        const transfer = await getTransfer(slug, controller.signal);
        if (!controller.signal.aborted) setState({ status: "ready", transfer });
      } catch (error) {
        if (!controller.signal.aborted) {
          setState({
            status: "error",
            reason:
              error instanceof TransferDomainError
                ? error.reason
                : "connection",
          });
        }
      }
    }

    void loadTransfer();
    return () => controller.abort();
  }, [slug, loadAttempt]);

  async function handleDownload() {
    if (
      getOwnerToken(slug) !== null ||
      admissionInFlight.current ||
      revokeInFlight.current ||
      state.status !== "ready" ||
      state.transfer.downloadCount >= state.transfer.maxDownloads
    )
      return;

    admissionInFlight.current = true;
    setIsDownloading(true);
    setDownloadError("");
    setDownloadStarted(false);

    try {
      const admission = await requestDownload(slug);

      // A successful admission consumes a slot, even if navigation later fails.
      setState((current) => {
        if (current.status !== "ready") return current;
        const downloadCount = current.transfer.downloadCount + 1;
        return {
          status: "ready",
          transfer: { ...current.transfer, downloadCount },
        };
      });

      const downloadUrl = await admission.readDownloadUrl();
      window.location.assign(downloadUrl);
      setDownloadStarted(true);
    } catch (error) {
      if (error instanceof TransferDomainError) {
        setState({ status: "error", reason: error.reason });
        return;
      }
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
    if (
      revokeInFlight.current ||
      admissionInFlight.current ||
      (state.status === "error" && state.reason === "revoked")
    )
      return;

    const ownerToken = getOwnerToken(slug);
    if (!ownerToken) {
      setRevokeError(
        "This browser can no longer authorize changes to this transfer.",
      );
      return;
    }

    revokeInFlight.current = true;
    setIsRevoking(true);
    setRevokeError("");

    try {
      await revokeTransfer(slug, ownerToken);

      focusRevokedHeadingOnClose.current = true;
      setState({ status: "error", reason: "revoked" });
      setConfirmRevoke(false);
      setDownloadError("");
      if (!removeOwnerToken(slug)) {
        setRevokeError(
          "Transfer revoked, but this browser could not clear its saved ownership.",
        );
      }
    } catch (error) {
      if (error instanceof TransferAuthorizationError) {
        setRevokeError(
          "This browser can no longer authorize changes to this transfer.",
        );
      } else {
        setRevokeError(
          "Unable to revoke the transfer. Please try again later.",
        );
      }
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

  const remainingDownloads =
    state.status === "ready"
      ? Math.max(0, state.transfer.maxDownloads - state.transfer.downloadCount)
      : 0;
  const canManage =
    hasOwnerToken &&
    (state.status === "ready" ||
      (state.status === "error" && state.reason === "pending"));

  return (
    <main
      id="main-content"
      className="
      transfer-page mx-auto flex w-[calc(100%-40px)] max-w-140 flex-1 flex-col justify-center py-7
      phone:w-[calc(100%-32px)] phone:py-5
    "
    >
      <section
        className="overflow-hidden rounded-2xl border border-border/80 bg-surface/95 shadow-panel backdrop-blur-sm"
        aria-label="Transfer details"
      >
        {state.status === "ready" && (
          <header className="px-6 pt-7 pb-2 text-center phone:px-5">
            {hasOwnerToken && (
              <span className="mx-auto mb-3 grid size-12 place-items-center rounded-full border border-success/25 bg-green-600 text-white">
                <Icon name="check" className="size-8" />
              </span>
            )}
            <span
              className={`${hasOwnerToken ? "hidden" : "inline-flex"} items-center gap-1.75 rounded-full px-2.5 py-1.25 text-[12px] font-semibold
            ${!hasOwnerToken && !downloadStarted && remainingDownloads === 0 ? "bg-surface-subtle text-muted-strong" : "bg-green-600 text-white"}`}
            >
              <Icon
                className="size-3.75"
                name={
                  !hasOwnerToken && !downloadStarted && remainingDownloads === 0
                    ? "lock"
                    : "check"
                }
              />
              {hasOwnerToken
                ? "Ready to Share"
                : downloadStarted
                  ? "Download started"
                  : remainingDownloads === 0
                    ? "No downloads remaining"
                    : "Ready to Download"}
            </span>
            <h1
              className="
            mt-3 mb-2 font-heading text-[clamp(1.25rem,4vw,1.625rem)] font-semibold
            leading-tight tracking-[-0.055em] text-balance
          "
            >
              {hasOwnerToken
                ? "Your File is Ready"
                : isBundle
                  ? "You’ve Received Files"
                  : "You’ve Received a File"}
            </h1>
            <p className="text-[13px] leading-[1.6] text-muted">
              {hasOwnerToken
                ? "One link. Send it to someone who needs it."
                : isBundle
                  ? "Your files, together in one ZIP archive."
                  : "A file shared with you. Yours to download."}
            </p>
          </header>
        )}
        {state.status === "loading" && (
          <div
            className="flex flex-col items-center gap-4 px-7 py-9 text-center phone:px-5 phone:py-7"
            role="status"
          >
            <span className="mb-1 grid size-12 place-items-center rounded-2xl border border-border bg-surface-subtle text-brand">
              <span
                className="
              inline-block size-4.5 shrink-0 rounded-full border-2 border-current border-r-transparent
              animate-spin [animation-duration:850ms] motion-reduce:animate-none
            "
              />
            </span>
            <h1
              className="
              font-heading text-[clamp(1.375rem,4vw,1.625rem)] font-semibold leading-[1.35]
              tracking-[-0.045em] text-balance
            "
            >
              Getting Your Transfer
            </h1>
            <p className="mt-3 max-w-90 text-[14px] leading-[1.7] text-muted">
              Just a moment while we check the details.
            </p>
          </div>
        )}

        {state.status === "error" && (
          <TransferUnavailable
            reason={state.reason}
            hasOwnerToken={hasOwnerToken}
            onRetry={reloadTransfer}
            revokedHeadingRef={revokedHeading}
          />
        )}

        {state.status === "ready" && (
          <>
            {hasOwnerToken && (
              <ShareLinkControls
                shareUrl={shareUrl}
                copyState={copyState}
                onCopy={handleCopyLink}
              />
            )}
            <TransferMetadata
              transfer={state.transfer}
              hasOwnerToken={hasOwnerToken}
              isBundle={isBundle}
              remainingDownloads={remainingDownloads}
            />

            {!hasOwnerToken && (
              <DownloadControls
                isBundle={isBundle}
                isDownloading={isDownloading}
                isRevoking={isRevoking}
                remainingDownloads={remainingDownloads}
                downloadStarted={downloadStarted}
                downloadError={downloadError}
                onDownload={handleDownload}
              />
            )}
          </>
        )}

        {canManage && (
          <div
            className="
            flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1 border-t border-border
            bg-surface-subtle px-6 py-3 phone:px-5
          "
          >
            {confirmRevoke ? (
              <div className="grid w-full gap-4 py-1">
                <div>
                  <h2 className="mb-1.25 font-heading text-[14px] font-semibold">
                    Revoke This Transfer?
                  </h2>
                  <p className="text-[13px] leading-normal text-muted">
                    This stops new downloads. You can’t undo it.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    ref={keepTransferButton}
                    type="button"
                    className="
                    inline-flex items-center justify-center gap-2.5 rounded-lg border font-semibold
                    leading-[1.4] text-center no-underline transition-colors duration-150 ease-[ease]
                    motion-reduce:transition-none disabled:border-border disabled:bg-surface-subtle
                    disabled:text-muted min-h-12 px-5 py-2.75 border-border-strong bg-surface
                    text-foreground enabled:hover:bg-surface-subtle text-[13px] phone:flex-auto
                  "
                    disabled={isRevoking}
                    onClick={() => setConfirmRevoke(false)}
                  >
                    Keep Transfer
                  </button>
                  <button
                    type="button"
                    className="
                    inline-flex items-center justify-center gap-2.5 rounded-lg border font-semibold
                    leading-[1.4] text-center no-underline transition-colors duration-150 ease-[ease]
                    motion-reduce:transition-none disabled:border-border disabled:bg-surface-subtle
                    disabled:text-muted min-h-12 px-5 py-2.75 border-border bg-transparent text-danger
                    enabled:hover:bg-danger-soft enabled:hover:border-danger text-[13px] phone:flex-auto
                  "
                    disabled={isRevoking || isDownloading}
                    aria-busy={isRevoking}
                    onClick={handleRevoke}
                  >
                    {isRevoking ? (
                      <Icon
                        name="loader"
                        className="size-4.5 animate-spin [animation-duration:850ms] motion-reduce:animate-none"
                      />
                    ) : (
                      <Icon name="trash" />
                    )}
                    {isRevoking ? "Revoking…" : "Revoke Transfer"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  ref={revokeTrigger}
                  type="button"
                  className="
                  inline-flex items-center justify-center gap-2.5 rounded-lg border font-semibold
                  leading-[1.4] text-center no-underline transition-colors duration-150 ease-[ease]
                  motion-reduce:transition-none disabled:border-border disabled:bg-surface-subtle
                  disabled:text-muted min-h-12 border-transparent bg-transparent px-0 py-2.75
                  text-[13px] text-danger enabled:hover:bg-surface-subtle enabled:hover:text-foreground
                "
                  disabled={isRevoking || isDownloading}
                  onClick={() => setConfirmRevoke(true)}
                >
                  <Icon name="trash" /> Revoke Transfer
                </button>
              </>
            )}
          </div>
        )}
        {revokeError && (
          <p
            className="feedback-enter
          flex items-start gap-2.5 rounded-lg border border-transparent bg-danger-soft px-4 py-3.25
          text-[14px] leading-[1.6] text-danger wrap-anywhere mx-6 my-5
        "
            role="alert"
          >
            {revokeError}
          </p>
        )}
      </section>
      {state.status === "ready" && (
        <p className="mt-5.5 flex items-center justify-center gap-1.75 text-center text-[12px] text-muted">
          <Icon name="lock" className="size-3.5" />{" "}
          {hasOwnerToken
            ? "Your ownership stays in this browser."
            : "No account. Just the file you came for."}
        </p>
      )}
    </main>
  );
}

export default function Page() {
  const { slug } = useParams<{ slug: string }>();
  return <RecipientPage key={slug} slug={slug} />;
}
