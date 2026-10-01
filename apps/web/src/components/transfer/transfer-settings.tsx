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
      className={`mt-6 grid min-w-0 grid-cols-2 gap-5 border-0 p-0 compact:gap-3.5 ${hidden ? "hidden" : ""}`}
      disabled={disabled}
    >
      <legend className="sr-only">Transfer Settings</legend>
      <div className="min-w-0">
        <label
          className="mb-2 flex items-center gap-1.75 text-[13px] font-semibold compact:gap-1.25 compact:text-[12px]"
          htmlFor="expiry-hours"
        >
          <Icon name="clock" className="size-4 text-muted" />
          Expires After
        </label>
        <div
          className="
          flex items-center rounded-lg border border-border-strong bg-surface-subtle/30 pr-3
          focus-within:outline focus-within:outline-offset focus-within:outline-brand
          has-[input[aria-invalid=true]]:border-danger compact:pr-2.5
        "
        >
          <input
            ref={expiryInputRef}
            id="expiry-hours"
            type="number"
            className="
              h-11 w-full min-w-0 rounded-lg border-0 bg-transparent px-3 py-2.5 text-[16px]
              font-semibold text-foreground focus:outline-none disabled:text-muted compact:px-2.5
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
          <span className="pointer-events-none text-[13px] text-muted compact:text-[12px]">
            hours
          </span>
        </div>
        <p className="mt-1.5 text-[12px] text-muted" id="expiry-hint">
          1–168 hours
        </p>
      </div>
      <div className="min-w-0">
        <label
          className="mb-2 flex items-center gap-1.75 text-[13px] font-semibold compact:gap-1.25 compact:text-[12px]"
          htmlFor="download-limit"
        >
          <Icon name="file-download" className="size-4 text-muted" />
          Download Limit
        </label>
        <div
          className="
          flex items-center rounded-lg border border-border-strong bg-surface-subtle/30 pr-3
          focus-within:outline focus-within:outline-offset focus-within:outline-brand
          has-[input[aria-invalid=true]]:border-danger compact:pr-2.5
        "
        >
          <input
            ref={downloadsInputRef}
            id="download-limit"
            type="number"
            className="
              h-11 w-full min-w-0 rounded-lg border-0 bg-transparent px-3 py-2.5 text-[16px]
              font-semibold text-foreground focus:outline-none disabled:text-muted compact:px-2.5
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
          <span className="pointer-events-none text-[13px] text-muted compact:text-[12px]">
            {Number(downloadLimit) === 1 ? "download" : "downloads"}
          </span>
        </div>
        <p className="mt-1.5 text-[12px] text-muted" id="downloads-hint">
          1–100 downloads
        </p>
      </div>
    </fieldset>
  );
}
