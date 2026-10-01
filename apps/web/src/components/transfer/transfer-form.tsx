"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { FilePicker } from "@/components/transfer/file-picker";
import { TransferError } from "@/components/transfer/transfer-error";
import { TransferSettings } from "@/components/transfer/transfer-settings";
import { UploadProgress } from "@/components/transfer/upload-progress";
import {
  useTransferUpload,
  type UploadError,
} from "@/hooks/use-transfer-upload";
import { selectionError } from "@/lib/prepare-upload";
import {
  validateTransferSettings,
  type TransferSettingsError,
} from "@/lib/transfer/validation";

type FormError =
  | UploadError
  | TransferSettingsError
  | { field: "file"; message: string };

const phaseLabels = {
  idle: "Send File",
  bundling: "Bundling files…",
  preparing: "Preparing your transfer…",
  uploading: "Uploading your file…",
  finalizing: "Finalizing your transfer…",
  ready: "Transfer ready…",
};

export function TransferForm() {
  const router = useRouter();
  const {
    phase,
    progress,
    uploadName,
    error: uploadError,
    isBusy,
    startUpload,
    clearError,
  } = useTransferUpload();
  const [files, setFiles] = useState<File[]>([]);
  const [expiryHours, setExpiryHours] = useState("24");
  const [downloadLimit, setDownloadLimit] = useState("1");
  const [formError, setFormError] = useState<FormError | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const expiryInput = useRef<HTMLInputElement>(null);
  const downloadsInput = useRef<HTMLInputElement>(null);

  const error = formError ?? uploadError;
  const hasFiles = files.length > 0;
  const isTransferring = phase === "uploading" || phase === "finalizing";
  const phaseLabel =
    phase === "bundling"
      ? `Preparing ${files.length} files…`
      : phase === "idle" && files.length > 1
        ? `Send ${files.length} Files`
        : phaseLabels[phase];

  function clearErrors() {
    setFormError(null);
    clearError();
  }

  function clearFiles() {
    setFiles([]);
    clearErrors();
  }

  function handleFileSelection(selection: FileList | null, append = false) {
    if (isBusy || !selection?.length) return;
    const selected = append
      ? [...files, ...Array.from(selection)]
      : Array.from(selection);
    const message = selectionError(selected);
    if (message) {
      setFormError({ field: "file", message });
      return;
    }
    setFormError(null);
    clearError();
    setFiles(selected);
  }

  function removeFile(index: number) {
    if (isBusy) return;
    setFiles((current) => current.filter((_, position) => position !== index));
    clearErrors();
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy) return;
    const fileError = selectionError(files);
    if (fileError) {
      setFormError({ field: "file", message: fileError });
      fileInput.current?.focus();
      return;
    }

    const settings = validateTransferSettings(expiryHours, downloadLimit);
    if ("field" in settings) {
      setFormError(settings);
      if (settings.field === "expiry") expiryInput.current?.focus();
      else downloadsInput.current?.focus();
      return;
    }

    setFormError(null);
    const slug = await startUpload(files, settings);
    if (slug) router.push(`/d/${encodeURIComponent(slug)}`);
  }

  return (
    <form
      className="
        mx-auto max-w-140 rounded-2xl border border-border/80 bg-surface/95 p-7 shadow-panel backdrop-blur-sm
        compact:rounded-2xl compact:p-4.5 narrow:p-3
      "
      onSubmit={handleUpload}
      noValidate
      aria-label="Send a file"
      aria-busy={isBusy}
    >
      <FilePicker
        files={files}
        disabled={isBusy}
        hidden={isTransferring}
        hasError={error?.field === "file"}
        inputRef={fileInput}
        onFilesSelected={handleFileSelection}
        onRemoveFile={removeFile}
        onClearFiles={clearFiles}
      />
      <TransferSettings
        expiryHours={expiryHours}
        downloadLimit={downloadLimit}
        disabled={isBusy}
        hidden={isTransferring}
        expiryInvalid={error?.field === "expiry"}
        downloadsInvalid={error?.field === "downloads"}
        expiryInputRef={expiryInput}
        downloadsInputRef={downloadsInput}
        onExpiryChange={(value) => {
          setExpiryHours(value);
          clearErrors();
        }}
        onDownloadLimitChange={(value) => {
          setDownloadLimit(value);
          clearErrors();
        }}
      />
      {isTransferring && progress && (
        <UploadProgress
          phase={phase}
          progress={progress}
          uploadName={uploadName}
        />
      )}
      {error && <TransferError message={error.message} />}
      <button
        type="submit"
        className="
        inline-flex items-center justify-center gap-2.5 rounded-xl border font-semibold leading-[1.4]
        text-center no-underline shadow-sm transition-[background-color,box-shadow,transform] duration-150 ease-[ease]
        motion-reduce:transition-none disabled:border-border disabled:bg-surface-subtle
        disabled:text-muted border-transparent bg-brand text-white dark:text-on-brand enabled:hover:bg-brand-hover enabled:active:translate-y-px enabled:hover:shadow-md
        mt-6 min-h-13 w-full px-5 py-3 compact:mt-5
      "
        disabled={isBusy || !hasFiles}
      >
        {isBusy && (
          <Icon
            name="loader"
            className="animate-spin [animation-duration:850ms] motion-reduce:animate-none"
          />
        )}
        <span>{phaseLabel}</span>
        {!isBusy && <Icon name="arrow-right" />}
      </button>
      <span className="sr-only" role="status">
        {isBusy ? phaseLabel : ""}
      </span>
    </form>
  );
}
