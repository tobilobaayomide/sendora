"use client";

import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FileSummary } from "@/components/file-summary";
import { Icon } from "@/components/icon";
import { prepareUpload, selectionError } from "@/lib/prepare-upload";
import { formatFileSize } from "@/lib/format-file-size";
import { uploadFile, formatUploadEta, type UploadProgress } from "@/lib/upload-file";
import { storeOwnerToken } from "@/lib/transfer-ownership";

type UploadPhase = "idle" | "bundling" | "preparing" | "uploading" | "finalizing" | "ready";
type UploadError = { field: "file" | "expiry" | "downloads" | "upload"; message: string };
const phaseLabels: Record<UploadPhase, string> = {
  idle: "Send File",
  bundling: "Bundling files…",
  preparing: "Preparing your transfer…",
  uploading: "Uploading your file…",
  finalizing: "Finalizing your transfer…",
  ready: "Transfer ready…",
};

export default function Home() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const file = files.length === 1 ? files[0] : null;
  const [expiryHours, setExpiryHours] = useState("24");
  const [downloadLimit, setDownloadLimit] = useState("1");
  const [error, setError] = useState<UploadError | null>(null);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const expiryInput = useRef<HTMLInputElement>(null);
  const downloadsInput = useRef<HTMLInputElement>(null);
  const uploadInFlight = useRef(false);
  const dragDepth = useRef(0);
  const isLoading = phase !== "idle";

  const phaseLabel = phase === "bundling" ? `Preparing ${files.length} files…`
    : phase === "idle" && files.length > 1 ? `Send ${files.length} Files` : phaseLabels[phase];

  function chooseFiles(selection: FileList | null, append = false) {
    if (uploadInFlight.current || !selection?.length) return;
    const selected = append ? [...files, ...Array.from(selection)] : Array.from(selection);
    const message = selectionError(selected);
    if (message) {
      setError({ field: "file", message });
      return;
    }
    setError(null);
    setFiles(selected);
  }

  function removeFile(index: number) {
    if (uploadInFlight.current) return;
    setFiles((current) => current.filter((_, position) => position !== index));
    setError(null);
    fileInput.current?.focus();
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    chooseFiles(event.dataTransfer.files);
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploadInFlight.current) return;
    const fileError = selectionError(files);
    if (fileError) {
      setError({ field: "file", message: fileError });
      fileInput.current?.focus();
      return;
    }
    const expiresInHours = Number(expiryHours);
    const maxDownloads = Number(downloadLimit);
    if (!Number.isInteger(expiresInHours) || expiresInHours < 1 || expiresInHours > 168) {
      setError({ field: "expiry", message: "Choose a whole number from 1 to 168 hours." });
      expiryInput.current?.focus();
      return;
    }
    if (!Number.isInteger(maxDownloads) || maxDownloads < 1 || maxDownloads > 100) {
      setError({ field: "downloads", message: "Choose a whole number from 1 to 100 downloads." });
      downloadsInput.current?.focus();
      return;
    }
    uploadInFlight.current = true;
    setError(null);
    setProgress(null);
    setPhase(files.length > 1 ? "bundling" : "preparing");
    let packaged = files.length === 1;
    let uploadRequested = false;
    let uploadedToR2 = false;
    let completed = false;
    try {
      const file = await prepareUpload(files);
      packaged = true;
      setPhase("preparing");
      const contentType = file.type || "application/octet-stream";
      const response = await fetch("http://localhost:4000/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType,
          size: file.size,
          expiresInHours,
          maxDownloads,
        }),
      });
      if (!response.ok) throw new Error("Transfer creation failed.");
      const data: unknown = await response.json();
      if (
        typeof data !== "object" || data === null ||
        !("slug" in data) || typeof data.slug !== "string" || !data.slug ||
        !("uploadUrl" in data) || typeof data.uploadUrl !== "string" ||
        !("ownerToken" in data) || typeof data.ownerToken !== "string" ||
        !/^[A-Za-z0-9_-]{43}$/.test(data.ownerToken)
      ) throw new Error("Invalid transfer response.");

      if (!storeOwnerToken(data.slug, data.ownerToken)) {
        setError({ field: "upload", message: "Your browser couldn’t save ownership of this transfer. Allow site storage and try again." });
        return;
      }
      uploadRequested = true;
      setUploadName(file.name);
      setProgress({ loadedBytes: 0, totalBytes: file.size, percentage: 0, bytesPerSecond: null, remainingSeconds: null });
      setPhase("uploading");
      await uploadFile(data.uploadUrl, file, setProgress);
      uploadedToR2 = true;
      setPhase("finalizing");
      const completionResponse = await fetch(
        `http://localhost:4000/transfers/${encodeURIComponent(data.slug)}/complete`,
        { method: "POST" },
      );
      if (!completionResponse.ok) throw new Error("Transfer completion failed.");
      setPhase("ready");
      router.push(`/d/${encodeURIComponent(data.slug)}`);
      completed = true;
    } catch {
      setError({
        field: "upload",
        message: !packaged
          ? "We couldn’t bundle these files. Please try again or choose fewer files."
          : uploadedToR2
          ? "Your file was uploaded, but we couldn’t finalize the transfer. Please try again."
          : uploadRequested
          ? "We couldn’t upload your file. Check your connection and try again."
          : "We couldn’t prepare your transfer. Check your connection and try again.",
      });
    } finally {
      if (!completed) {
        uploadInFlight.current = false;
        setPhase("idle");
        setProgress(null);
      }
    }
  }

  return (
    <main id="main-content" className="mx-auto mt-7 w-[calc(100%-40px)] max-w-225 compact:mt-5 compact:w-[calc(100%-40px)]">
      <div className="mb-7 text-center compact:mb-6">
        <h1 className="
          font-heading text-[clamp(30px,4.4vw,44px)] font-semibold leading-[1.2] tracking-[-1.8px]
          text-balance compact:mx-auto compact:max-w-85 compact:tracking-[-1.1px]
        ">Send <span className="text-brand">Files</span>. Simple and <span className="text-brand">Secure</span>.</h1>
        <p className="
          mx-auto mt-4 max-w-107.5 text-[16px] leading-[1.65] text-balance text-muted compact:mt-3
          compact:max-w-70 compact:text-[14px]
        ">A temporary link for whatever comes next.<br />No account. Just send and share.</p>
      </div>
      <form
        className="
          mx-auto max-w-140 rounded-xl border border-border bg-surface p-6 shadow-panel
          compact:rounded-xl compact:p-4 narrow:p-3
        "
        onSubmit={handleUpload}
        noValidate
        aria-label="Send a file"
        aria-busy={isLoading}
      >
        <div
          className={`relative rounded-lg ${phase === "uploading" || phase === "finalizing" ? "hidden" : ""} ${files.length ? "" : "border border-dashed"}
            transition-colors duration-150 ease-[ease] motion-reduce:transition-none
            has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-4 has-[input:focus-visible]:outline-brand
            ${isDragging ? "border-brand bg-brand-soft" : files.length ? "" : "border-border-strong bg-surface-subtle/60"}
            ${isLoading || files.length ? "" : "hover:border-brand hover:bg-brand-soft"}`}
          onDragEnter={(event) => {
            event.preventDefault();
            if (uploadInFlight.current) return;
            dragDepth.current += 1;
            setIsDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = isLoading ? "none" : "copy";
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            dragDepth.current = Math.max(0, dragDepth.current - 1);
            if (dragDepth.current === 0) setIsDragging(false);
          }}
          onDrop={handleDrop}
        >
          <input
            ref={fileInput}
            id="upload-file"
            type="file"
            multiple
            className="sr-only"
            aria-label={files.length ? "Add Files" : "Choose Files"}
            aria-invalid={error?.field === "file"}
            aria-describedby={error?.field === "file" ? "upload-error" : undefined}
            disabled={isLoading}
            onChange={(event) => {
              chooseFiles(event.target.files, true);
              event.target.value = "";
            }}
          />
          {files.length > 1 ? (
            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-1 text-[13px]">
                <p className="font-semibold">{files.length} files selected</p>
                <p className="text-[12px] tabular-nums text-muted">{formatFileSize(files.reduce((total, selected) => total + selected.size, 0))} total</p>
              </div>
              <ul className="mt-3 max-h-52 overflow-y-auto overscroll-contain rounded-lg border border-border divide-y divide-border bg-surface-subtle/40" aria-label="Selected files">
                {files.map((selected, index) => (
                  <li key={index} className="px-2.5 py-1.5">
                    <FileSummary filename={selected.name} size={selected.size} variant="list">
                      <button type="button" className="grid size-11 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-danger disabled:opacity-50 motion-reduce:transition-none"
                        disabled={isLoading} aria-label={`Remove ${selected.name}`} onClick={() => removeFile(index)}><Icon name="x" className="size-4" /></button>
                    </FileSummary>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-center justify-between gap-3 text-[12px] font-semibold">
                <button type="button" className="inline-flex items-center justify-center gap-2 min-h-11 rounded-lg border border-border-strong px-3 text-brand-hover transition-colors hover:bg-brand-soft disabled:text-muted motion-reduce:transition-none" disabled={isLoading} onClick={() => fileInput.current?.click()}><Icon name="plus" className="size-3.5" />Add Files</button>
                <button type="button" className="inline-flex items-center gap-1.5 min-h-11 rounded-lg px-2 text-danger hover:bg-danger-soft disabled:opacity-50" disabled={isLoading} onClick={() => { setFiles([]); setError(null); fileInput.current?.focus(); }}><Icon name="trash" className="size-3.5" />Clear All</button>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted">Multiple files will be bundled into one ZIP. Up to 500 MB total.</p>
            </div>
          ) : file ? (
            <div>
              <div className="rounded-lg border border-border bg-surface-subtle/40 px-3 py-3"><FileSummary filename={file.name} size={file.size} variant="upload">
                <button type="button" className="grid size-11 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-danger disabled:opacity-50 motion-reduce:transition-none"
                  disabled={isLoading} aria-label={`Remove ${file.name}`}
                  onClick={() => { setFiles([]); setError(null); fileInput.current?.focus(); }}>
                  <Icon name="x" className="size-4" />
                </button>
              </FileSummary></div>
              <button type="button" className="mt-3 inline-flex w-full items-center justify-center gap-2 min-h-11 rounded-lg border border-brand/50 bg-brand-soft/30 px-3 text-[13px] font-semibold text-brand-hover transition-colors hover:bg-brand-soft disabled:text-muted motion-reduce:transition-none"
                disabled={isLoading} onClick={() => fileInput.current?.click()}><Icon name="plus" className="size-4" />Add File</button>
            </div>
          ) : (
            <label className={`flex min-h-48 flex-col items-center justify-center px-4 py-6 text-center ${isLoading ? "cursor-default" : "cursor-pointer"}`} htmlFor="upload-file">
              <span className="mb-4 grid size-12 place-items-center rounded-xl bg-brand-soft text-brand-hover"><Icon name="arrow-up" className="size-6" /></span>
              <span className="text-[16px] font-semibold">{isDragging ? "Drop it Here" : "Drop Your Files Here"}</span>
              <span className="mt-0.75 text-[14px] text-muted">or <span className="text-brand-hover underline underline-offset-[3px]">Browse Files</span></span>
              <span className="mt-3 text-[12px] text-muted">One Link. Any Format.</span>
            </label>
          )}
        </div>
        <fieldset className={`mt-6 grid min-w-0 grid-cols-2 gap-5 border-0 p-0 compact:gap-3.5 ${phase === "uploading" || phase === "finalizing" ? "hidden" : ""}`} disabled={isLoading}>
          <legend className="sr-only">Transfer Settings</legend>
          <div className="min-w-0">
            <label className="mb-2 flex items-center gap-1.75 text-[13px] font-semibold compact:gap-1.25 compact:text-[12px]" htmlFor="expiry-hours"><Icon name="clock" className="size-4 text-muted" />Expires After</label>
            <div className="
              flex items-center rounded-lg border border-border-strong bg-surface-subtle/30 pr-3
              focus-within:outline focus-within:outline-offset focus-within:outline-brand
              has-[input[aria-invalid=true]]:border-danger compact:pr-2.5
            ">
              <input
                ref={expiryInput}
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
                aria-invalid={error?.field === "expiry"}
                aria-describedby={error?.field === "expiry" ? "expiry-hint upload-error" : "expiry-hint"}
                onChange={(event) => {
                  setExpiryHours(event.target.value);
                  setError(null);
                }}
              />
              <span className="pointer-events-none text-[13px] text-muted compact:text-[12px]">hours</span>
            </div>
            <p className="mt-1.5 text-[12px] text-muted" id="expiry-hint">1–168 hours</p>
          </div>
          <div className="min-w-0">
            <label className="mb-2 flex items-center gap-1.75 text-[13px] font-semibold compact:gap-1.25 compact:text-[12px]" htmlFor="download-limit"><Icon name="file-download" className="size-4 text-muted" />Download Limit</label>
            <div className="
              flex items-center rounded-lg border border-border-strong bg-surface-subtle/30 pr-3
              focus-within:outline focus-within:outline-offset focus-within:outline-brand
              has-[input[aria-invalid=true]]:border-danger compact:pr-2.5
            ">
              <input
                ref={downloadsInput}
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
                aria-invalid={error?.field === "downloads"}
                aria-describedby={error?.field === "downloads" ? "downloads-hint upload-error" : "downloads-hint"}
                onChange={(event) => {
                  setDownloadLimit(event.target.value);
                  setError(null);
                }}
              />
              <span className="pointer-events-none text-[13px] text-muted compact:text-[12px]">{Number(downloadLimit) === 1 ? "download" : "downloads"}</span>
            </div>
            <p className="mt-1.5 text-[12px] text-muted" id="downloads-hint">1–100 downloads</p>
          </div>
        </fieldset>
        {(phase === "uploading" || phase === "finalizing") && progress && (
          <div>
            <div className="rounded-lg border border-border bg-surface-subtle/40 p-3"><FileSummary filename={uploadName} size={progress.totalBytes} variant="upload" /></div>
            <div className="mt-5 flex flex-wrap justify-between gap-2 text-[12px] tabular-nums">
              <span className="font-semibold">{phase === "finalizing" ? "Finalizing transfer…" : `Uploading… ${Math.floor(progress.percentage)}%`}</span>
              <span className="text-muted">{formatFileSize(progress.loadedBytes)} of {formatFileSize(progress.totalBytes)}</span>
            </div>
            <div role="progressbar" aria-label="File upload" aria-valuemin={0} aria-valuemax={100}
              aria-valuenow={Math.floor(progress.percentage)}
              aria-valuetext={`${Math.floor(progress.percentage)}%, ${formatFileSize(progress.loadedBytes)} of ${formatFileSize(progress.totalBytes)}`}
              className="mt-3 h-2 overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full bg-brand transition-[width] duration-150 ease-linear motion-reduce:transition-none" style={{ width: `${progress.percentage}%` }} />
            </div>
            {phase === "uploading" && progress.bytesPerSecond !== null && <div className="mt-3 flex flex-wrap justify-between gap-2 text-[12px] text-muted tabular-nums">
              <span>{formatFileSize(progress.bytesPerSecond)}/s</span>
              {formatUploadEta(progress.remainingSeconds) && <span className="flex items-center gap-1.5"><Icon name="clock" className="size-3.5" />{formatUploadEta(progress.remainingSeconds)}</span>}
            </div>}
            <p className="mt-2 text-[12px] text-muted">{phase === "finalizing" ? "Verifying your upload. Your link will be ready shortly." : progress.percentage === 100 ? "Upload sent. Waiting for confirmation…" : "Uploading securely…"}</p>
          </div>
        )}
        {error && (
          <div id="upload-error" className="
            flex items-start gap-2.5 rounded-lg border border-transparent bg-danger-soft px-4 py-3.25
            text-[14px] leading-[1.6] text-danger wrap-anywhere mt-5
          " role="alert">
            <Icon name="alert" className="mt-0.5" />
            <p>{error.message}</p>
          </div>
        )}
        <button type="submit" className="
          inline-flex items-center justify-center gap-2.5 rounded-lg border font-semibold leading-[1.4]
          text-center no-underline transition-colors duration-150 ease-[ease]
          motion-reduce:transition-none disabled:border-border disabled:bg-surface-subtle
          disabled:text-muted border-transparent bg-action text-on-brand enabled:hover:bg-action-hover enabled:active:brightness-95
          mt-5 min-h-12 w-full px-5 py-2.75
        " disabled={isLoading || !files.length}>
          {isLoading && <Icon name="loader" className="animate-spin [animation-duration:850ms] motion-reduce:animate-none" />}
          <span>{phaseLabel}</span>
          {!isLoading && <Icon name="arrow-right" />}
        </button>
      </form>
      <span className="sr-only" role="status">{isLoading ? phaseLabel : ""}</span>
      <ul className="
        mx-auto mt-7 flex list-none flex-wrap items-center justify-center gap-x-6 gap-y-3 p-0 text-[12px]
        text-muted compact:gap-x-4 compact:gap-y-2.5 compact:text-[11px]
      " aria-label="Simple, temporary sharing">
        <li className="flex items-center gap-1.5"><Icon className="size-3.75" name="users" />No Account</li>
        <li className="flex items-center gap-1.5"><Icon className="size-3.75" name="lock" />Private Transfers</li>
        <li className="flex items-center gap-1.5"><Icon className="size-3.75" name="clock" />Auto-Deleted</li>
      </ul>
    </main>
  );
}
