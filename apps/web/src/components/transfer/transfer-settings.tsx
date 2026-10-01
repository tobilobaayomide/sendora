import type { RefObject } from "react";
import { Icon } from "@/components/icon";

export function TransferSettings({
  expiryHours,
  downloadLimit,
  disabled,
  hidden,
  expiryInvalid,
  downloadsInvalid,
  expiryInputRef,
  downloadsInputRef,
  onExpiryChange,
  onDownloadLimitChange,
}: {
  expiryHours: string;
  downloadLimit: string;
  disabled: boolean;
  hidden: boolean;
  expiryInvalid: boolean;
  downloadsInvalid: boolean;
  expiryInputRef: RefObject<HTMLInputElement | null>;
  downloadsInputRef: RefObject<HTMLInputElement | null>;
  onExpiryChange: (value: string) => void;
  onDownloadLimitChange: (value: string) => void;
}) {
  return (
    <fieldset
      className={`mt-6 grid min-w-0 grid-cols-2 gap-5 border-0 border-t border-border/80 p-0 pt-5 compact:mt-5 compact:gap-3 compact:pt-4 ${hidden ? "hidden" : ""}`}
      disabled={disabled}
    >
      <legend className="sr-only">Transfer Settings</legend>
      <div className="min-w-0">
        <label
          className="mb-2 flex items-center gap-2 text-[13px] font-semibold tracking-[-0.1px] compact:gap-1.5 compact:text-[12px]"
          htmlFor="expiry-hours"
        >
          <Icon name="clock" className="size-4 text-brand" />
          Expires After
        </label>
        <div
          className="
          flex items-center rounded-xl border border-border-strong/70 bg-surface px-1.5 pr-2.5
          shadow-sm transition-[border-color,box-shadow] duration-150
          hover:border-brand/45 focus-within:border-brand focus-within:ring-3 focus-within:ring-brand/10
          has-[input[aria-invalid=true]]:border-danger has-[input[aria-invalid=true]]:focus-within:ring-danger/10
          compact:pr-2
        "
        >
          <input
            ref={expiryInputRef}
            id="expiry-hours"
            type="number"
            className="
              h-11 w-full min-w-0 rounded-lg border-0 bg-transparent px-2.5 py-2.5 text-[16px]
              font-semibold tabular-nums text-foreground focus:outline-none disabled:text-muted compact:px-2
            "
            min={1}
            max={168}
            step={1}
            value={expiryHours}
            aria-invalid={expiryInvalid}
            aria-describedby={
              expiryInvalid ? "expiry-hint upload-error" : "expiry-hint"
            }
            onChange={(event) => onExpiryChange(event.target.value)}
          />
          <span className="pointer-events-none shrink-0 rounded-md bg-surface-subtle px-2 py-1 text-[11px] font-medium text-muted compact:px-1.5">
            Hours
          </span>
        </div>
        <p className="mt-2 text-[11px] text-muted" id="expiry-hint">
          1–168 Hours
        </p>
      </div>
      <div className="min-w-0">
        <label
          className="mb-2 flex items-center gap-2 text-[13px] font-semibold tracking-[-0.1px] compact:gap-1.5 compact:text-[12px]"
          htmlFor="download-limit"
        >
          <Icon name="file-download" className="size-4 text-brand" />
          Download Limit
        </label>
        <div
          className="
          flex items-center rounded-xl border border-border-strong/70 bg-surface px-1.5 pr-2.5
          shadow-sm transition-[border-color,box-shadow] duration-150
          hover:border-brand/45 focus-within:border-brand focus-within:ring-3 focus-within:ring-brand/10
          has-[input[aria-invalid=true]]:border-danger has-[input[aria-invalid=true]]:focus-within:ring-danger/10
          compact:pr-2
        "
        >
          <input
            ref={downloadsInputRef}
            id="download-limit"
            type="number"
            className="
              h-11 w-full min-w-0 rounded-lg border-0 bg-transparent px-2.5 py-2.5 text-[16px]
              font-semibold tabular-nums text-foreground focus:outline-none disabled:text-muted compact:px-2
            "
            min={1}
            max={100}
            step={1}
            value={downloadLimit}
            aria-invalid={downloadsInvalid}
            aria-describedby={
              downloadsInvalid ? "downloads-hint upload-error" : "downloads-hint"
            }
            onChange={(event) => onDownloadLimitChange(event.target.value)}
          />
          <span className="pointer-events-none shrink-0 rounded-md bg-surface-subtle px-2 py-1 text-[11px] font-medium text-muted compact:px-1.5">
            {Number(downloadLimit) === 1 ? "Download" : "Downloads"}
          </span>
        </div>
        <p className="mt-2 text-[11px] text-muted" id="downloads-hint">
          1–100 Downloads
        </p>
      </div>
    </fieldset>
  );
}
