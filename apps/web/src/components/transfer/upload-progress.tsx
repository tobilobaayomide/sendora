import { FileSummary } from "@/components/file-summary";
import { Icon } from "@/components/icon";
import { formatFileSize } from "@/lib/format-file-size";
import {
  formatUploadEta,
  type UploadProgress as Progress,
} from "@/lib/upload-file";
import type { UploadPhase } from "@/hooks/use-transfer-upload";

export function UploadProgress({
  phase,
  progress,
  uploadName,
}: {
  phase: UploadPhase;
  progress: Progress;
  uploadName: string;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface-subtle/35 p-4 compact:p-3.5" aria-label="Transfer progress">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] font-semibold text-muted">
          {phase === "finalizing" ? "TRANSFER STATUS" : "SENDING YOUR FILE"}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-semibold text-brand-hover">
          {phase === "finalizing" ? (
            <Icon name="shield" className="size-3.5" />
          ) : (
            <Icon name="loader" className="size-3.5 animate-spin motion-reduce:animate-none" />
          )}
          {phase === "finalizing" ? "Almost Done" : "In Progress"}
        </span>
      </div>
      <div className="mt-3 rounded-xl border border-border/80 bg-surface px-3 py-3">
        <FileSummary
          filename={uploadName}
          size={progress.totalBytes}
          variant="upload"
        />
      </div>
      <div className="mt-5 flex items-baseline justify-between gap-3 tabular-nums">
        <span className="text-[13px] font-semibold">
          {phase === "finalizing" ? "Finalizing Transfer" : "Uploading Securely"}
        </span>
        <span className="text-[20px] font-semibold leading-none tracking-[-0.6px] text-brand">
          {Math.floor(progress.percentage)}<span className="text-[13px]">%</span>
        </span>
      </div>
      <p className="mt-1.5 text-[11px] tabular-nums text-muted">
        {formatFileSize(progress.loadedBytes)} of {formatFileSize(progress.totalBytes)}
      </p>
      <div
        role="progressbar"
        aria-label="File upload"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.floor(progress.percentage)}
        aria-valuetext={`${Math.floor(progress.percentage)}%, ${formatFileSize(progress.loadedBytes)} of ${formatFileSize(progress.totalBytes)}`}
        className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-border/70"
      >
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-200 ease-out motion-reduce:transition-none"
          style={{ width: `${progress.percentage}%` }}
        />
      </div>
      {phase === "uploading" && progress.bytesPerSecond !== null && (
        <div className="mt-3 flex flex-wrap justify-between gap-2 text-[11px] font-medium text-muted tabular-nums">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-brand" />
            {formatFileSize(progress.bytesPerSecond)}/s
          </span>
          {formatUploadEta(progress.remainingSeconds) && (
            <span className="flex items-center gap-1.5">
              <Icon name="clock" className="size-3.5 text-brand" />
              {formatUploadEta(progress.remainingSeconds)}
            </span>
          )}
        </div>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        {phase === "finalizing"
          ? "Verifying your upload. Your link will be ready shortly."
          : progress.percentage === 100
            ? "Upload sent. Waiting for confirmation…"
            : "Your transfer link will be ready when the upload finishes."}
      </p>
    </section>
  );
}
