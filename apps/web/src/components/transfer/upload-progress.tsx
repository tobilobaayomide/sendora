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
    <div>
      <div className="rounded-lg border border-border bg-surface-subtle/40 p-3">
        <FileSummary
          filename={uploadName}
          size={progress.totalBytes}
          variant="upload"
        />
      </div>
      <div className="mt-5 flex flex-wrap justify-between gap-2 text-[12px] tabular-nums">
        <span className="font-semibold">
          {phase === "finalizing"
            ? "Finalizing transfer…"
            : `Uploading… ${Math.floor(progress.percentage)}%`}
        </span>
        <span className="text-muted">
          {formatFileSize(progress.loadedBytes)} of{" "}
          {formatFileSize(progress.totalBytes)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="File upload"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.floor(progress.percentage)}
        aria-valuetext={`${Math.floor(progress.percentage)}%, ${formatFileSize(progress.loadedBytes)} of ${formatFileSize(progress.totalBytes)}`}
        className="mt-3 h-2 overflow-hidden rounded-full bg-border"
      >
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-150 ease-linear motion-reduce:transition-none"
          style={{ width: `${progress.percentage}%` }}
        />
      </div>
      {phase === "uploading" && progress.bytesPerSecond !== null && (
        <div className="mt-3 flex flex-wrap justify-between gap-2 text-[12px] text-muted tabular-nums">
          <span>{formatFileSize(progress.bytesPerSecond)}/s</span>
          {formatUploadEta(progress.remainingSeconds) && (
            <span className="flex items-center gap-1.5">
              <Icon name="clock" className="size-3.5" />
              {formatUploadEta(progress.remainingSeconds)}
            </span>
          )}
        </div>
      )}
      <p className="mt-2 text-[12px] text-muted">
        {phase === "finalizing"
          ? "Verifying your upload. Your link will be ready shortly."
          : progress.percentage === 100
            ? "Upload sent. Waiting for confirmation…"
            : "Uploading securely…"}
      </p>
    </div>
  );
}
