import Link from "next/link";
import type { RefObject } from "react";
import { Icon } from "@/components/icon";
import type { TransferErrorReason } from "@/lib/transfer-unavailable";

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

export function TransferUnavailable({
  reason,
  hasOwnerToken,
  onRetry,
  revokedHeadingRef,
}: {
  reason: TransferErrorReason;
  hasOwnerToken: boolean;
  onRetry: () => void;
  revokedHeadingRef: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <div className="flex flex-col items-center gap-4 px-7 py-9 text-center phone:px-5 phone:py-7">
      <span className="mb-1 grid size-12 place-items-center rounded-2xl border border-border bg-surface-subtle text-brand">
        <Icon className="size-6" name={unavailableCopy[reason].icon} />
      </span>
      <div role="alert">
        <h1
          className="
            font-heading text-[clamp(1.375rem,4vw,1.625rem)] font-semibold leading-[1.35]
            tracking-[-0.045em] text-balance
          "
          ref={reason === "revoked" ? revokedHeadingRef : undefined}
          tabIndex={reason === "revoked" ? -1 : undefined}
        >
          {unavailableCopy[reason].title}
        </h1>
        <p className="mt-3 max-w-90 text-[14px] leading-[1.7] text-muted">
          {hasOwnerToken && reason === "pending"
            ? "Your upload hasn’t finished yet. Once it’s complete, your link will be ready to share."
            : unavailableCopy[reason].description}
        </p>
      </div>
      {reason === "pending" || reason === "connection" ? (
        <button type="button" className="
          inline-flex items-center justify-center gap-2.5 rounded-lg border font-semibold
          leading-[1.4] text-center no-underline transition-colors duration-150 ease-[ease]
          motion-reduce:transition-none disabled:border-border disabled:bg-surface-subtle
          disabled:text-muted min-h-12 px-5 py-2.75 border-border-strong bg-surface
          text-foreground enabled:hover:bg-surface-subtle mt-2
        " onClick={onRetry}>
          <Icon name="refresh" />
          {reason === "pending" ? "Check Again" : "Try Again"}
        </button>
      ) : (
        <Link href="/" className="
          inline-flex items-center justify-center gap-2.5 rounded-lg border font-semibold
          leading-[1.4] text-center no-underline transition-colors duration-150 ease-[ease]
          motion-reduce:transition-none disabled:border-border disabled:bg-surface-subtle
          disabled:text-muted min-h-12 px-5 py-2.75 border-border-strong bg-surface
          text-foreground hover:bg-surface-subtle mt-2
        ">
          Send a File <Icon name="arrow-right" />
        </Link>
      )}
    </div>
  );
}
