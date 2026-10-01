import { Icon } from "@/components/icon";

export function DownloadControls({
  isBundle,
  isDownloading,
  isRevoking,
  remainingDownloads,
  downloadStarted,
  downloadError,
  onDownload,
}: {
  isBundle: boolean;
  isDownloading: boolean;
  isRevoking: boolean;
  remainingDownloads: number;
  downloadStarted: boolean;
  downloadError: string;
  onDownload: () => void;
}) {
  return (
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
        onClick={onDownload}
      >
        {isDownloading ? <Icon name="loader" className="size-4.5 animate-spin [animation-duration:850ms] motion-reduce:animate-none" /> : <Icon name="arrow-down" />}
        {isDownloading
          ? "Preparing download…"
          : remainingDownloads === 0
            ? downloadStarted ? "Download started" : "No downloads remaining"
            : isBundle ? "Download All" : "Download File"}
      </button>
      <p className="mt-3 text-center text-[12px] leading-[1.6] text-muted">
        {remainingDownloads === 0
          ? "0 downloads remaining. Another download cannot be started."
          : "Starting a download uses one of the remaining downloads."}
      </p>
      {downloadStarted && <p className="mt-2.5 text-center text-[13px] text-success" role="status">Your Download is Starting.</p>}
      {downloadError && <p className="
        flex items-start gap-2.5 rounded-lg border border-transparent bg-danger-soft px-4
        py-3.25 text-[14px] leading-[1.6] text-danger wrap-anywhere mt-4
      " role="alert">{downloadError}</p>}
    </div>
  );
}
