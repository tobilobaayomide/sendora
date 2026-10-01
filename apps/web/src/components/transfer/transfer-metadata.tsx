import { FileSummary } from "@/components/file-summary";
import { Icon } from "@/components/icon";
import type { Transfer } from "@/lib/transfer/api";

export function TransferMetadata({
  transfer,
  hasOwnerToken,
  isBundle,
  remainingDownloads,
}: {
  transfer: Transfer;
  hasOwnerToken: boolean;
  isBundle: boolean;
  remainingDownloads: number;
}) {
  return (
    <>
      <div
        className={`px-6 pb-5 phone:px-5 ${hasOwnerToken ? "pt-1" : "pt-6"}`}
      >
        <div className="rounded-xl bg-surface-subtle/55 px-4 py-4">
          <FileSummary
            filename={transfer.filename}
            size={transfer.size}
            detail={isBundle ? "ZIP archive" : undefined}
            variant={hasOwnerToken ? "transfer" : "recipient"}
          />
        </div>
      </div>
      <dl className="mx-6 grid grid-cols-[1.4fr_1fr] gap-4 border-y border-border/80 py-5 phone:mx-5 narrow:grid-cols-1 narrow:gap-3">
        <div className="min-w-0">
          <dt className="mb-2 flex items-center gap-1.75 text-[13px]">
            <Icon className="text-brand size-3.75" name="clock" /> Expires
          </dt>
          <dd className="text-[14px] font-semibold leading-[1.6] tabular-nums">
            <time dateTime={transfer.expiresAt}>
              {new Date(transfer.expiresAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </time>
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="mb-2 flex items-center gap-1.75 text-[13px] ">
            <Icon className="text-brand size-3.75" name="cloud-download" />{" "}
            {hasOwnerToken ? "Downloads Used" : "Downloads Left"}
          </dt>
          <dd
            className="text-[14px] font-semibold leading-[1.6] tabular-nums"
            aria-live="polite"
          >
            {hasOwnerToken ? (
              <>
                {transfer.downloadCount}{" "}
                <span className="font-normal text-muted">
                  / {transfer.maxDownloads}
                </span>
              </>
            ) : (
              remainingDownloads
            )}
          </dd>
        </div>
      </dl>
    </>
  );
}
