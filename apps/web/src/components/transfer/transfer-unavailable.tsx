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
    icon: "cloud-download",
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
  const iconTone =
    reason === "pending" || reason === "connection"
      ? "text-brand-hover"
      : reason === "missing"
        ? "text-muted-strong"
        : "text-danger";

  return (
    <div className="feedback-enter flex flex-col items-center gap-3.5 px-8 py-10 text-center phone:px-5 phone:py-8">
      <span className={`mb-1 grid size-14 place-items-center ${iconTone}`}>
        <Icon className="size-12" name={unavailableCopy[reason].icon} />
      </span>
      <div role="alert">
        <h1
          className="
            font-heading text-[21px] font-semibold leading-[1.3]
            tracking-[-0.55px] text-balance
          "
          ref={reason === "revoked" ? revokedHeadingRef : undefined}
          tabIndex={reason === "revoked" ? -1 : undefined}
        >
          {unavailableCopy[reason].title}
        </h1>
        <p className="mx-auto mt-2.5 max-w-90 text-[14px] leading-[1.65] text-muted">
          {hasOwnerToken && reason === "pending"
            ? "Your upload hasn’t finished yet. Once it’s complete, your link will be ready to share."
            : unavailableCopy[reason].description}
        </p>
      </div>
      {reason === "pending" || reason === "connection" ? (
        <button type="button" className="
          mt-2 inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl border border-border
          bg-surface px-5 py-2.75 font-semibold leading-[1.4] text-foreground
          transition-colors duration-150 hover:bg-surface-subtle motion-reduce:transition-none
        " onClick={onRetry}>
          <Icon name="refresh" />
          {reason === "pending" ? "Check Again" : "Try Again"}
        </button>
      ) : (
        <Link href="/" className="
          mt-2 inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl border border-transparent
          bg-brand px-5 py-2.75 font-semibold leading-[1.4] text-white shadow-sm
          transition-[background-color,box-shadow,transform] duration-150 hover:bg-brand-hover
          hover:shadow-md active:translate-y-px dark:text-on-brand motion-reduce:transition-none
        ">
          Send a File <Icon name="arrow-right" />
        </Link>
      )}
    </div>
  );
}
