"use client";

import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FileSummary } from "@/components/file-summary";
import { Icon } from "@/components/icon";
import { prepareUpload, selectionError } from "@/lib/prepare-upload";
import { formatFileSize } from "@/lib/format-file-size";
import { storeOwnerToken } from "@/lib/transfer-ownership";

type UploadPhase = "idle" | "bundling" | "preparing" | "uploading" | "finalizing" | "ready";
type UploadError = { field: "file" | "expiry" | "downloads" | "upload"; message: string };
const phaseLabels: Record<UploadPhase, string> = {
  idle: "Send file",
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
  const [isDragging, setIsDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const expiryInput = useRef<HTMLInputElement>(null);
  const downloadsInput = useRef<HTMLInputElement>(null);
  const uploadInFlight = useRef(false);
  const dragDepth = useRef(0);
  const isLoading = phase !== "idle";

  const phaseLabel = phase === "bundling" ? `Preparing ${files.length} files…`
    : phase === "idle" && files.length > 1 ? `Send ${files.length} files` : phaseLabels[phase];

  function chooseFiles(selection: FileList | null) {
    if (uploadInFlight.current || !selection?.length) return;
    const selected = Array.from(selection);
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
    setPhase(files.length > 1 ? "bundling" : "preparing");
    let packaged = files.length === 1;
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
      setPhase("uploading");
      const uploadResponse = await fetch(data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });
      if (!uploadResponse.ok) throw new Error("File upload failed.");
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
          : "We couldn’t upload your file. Check your connection and try again.",
      });
    } finally {
      if (!completed) {
        uploadInFlight.current = false;
        setPhase("idle");
      }
    }
  }

  return (
    <main id="main-content" className="mx-auto mt-[30px] w-[calc(100%_-_40px)] max-w-[900px] compact:mt-5">
      <div className="mb-8 text-center compact:mb-[26px]">
        <h1 className="
          font-heading text-[clamp(30px,4.4vw,44px)] font-semibold leading-[1.2] tracking-[-1.8px]
          text-balance compact:mx-auto compact:max-w-[340px] compact:tracking-[-1.1px]
        ">Send <span className="text-brand">Files</span>. Simple and <span className="text-brand">Secure</span>.</h1>
        <p className="
          mx-auto mt-4 max-w-[430px] text-[16px] leading-[1.65] text-balance text-muted compact:mt-3
          compact:max-w-[280px] compact:text-[14px]
        ">A temporary link for whatever comes next.<br />No account. Just send and share.</p>
      </div>
      <form
        className="
          mx-auto max-w-[584px] rounded-2xl border border-border bg-surface p-7 shadow-panel
          compact:rounded-xl compact:p-5 narrow:p-4
        "
        onSubmit={handleUpload}
        noValidate
        aria-label="Send a file"
        aria-busy={isLoading}
      >
        <div
          className={`relative rounded-[10px] border-[1.5px] border-dashed
            transition-colors duration-150 ease-[ease] motion-reduce:transition-none
            focus-within:outline-3 focus-within:outline-offset-4 focus-within:outline-brand
            ${isDragging ? "border-brand bg-brand-soft" : "border-border-strong bg-surface-subtle"}
            ${isLoading ? "" : "hover:border-brand hover:bg-brand-soft"}`}
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
            aria-label={files.length ? "Change selected files" : "Choose files"}
            aria-invalid={error?.field === "file"}
            aria-describedby={error?.field === "file" ? "upload-error" : undefined}
            disabled={isLoading}
            onChange={(event) => {
              chooseFiles(event.target.files);
              event.target.value = "";
            }}
          />
          {files.length > 1 ? (
            <div className="px-5 py-5 narrow:px-3">
              <p className="font-semibold">{files.length} files selected</p>
              <p className="mt-1 text-[13px] text-muted">{formatFileSize(files.reduce((total, selected) => total + selected.size, 0))} total</p>
              <p className="mt-2 text-[12px] text-muted">Multiple files will be bundled into one ZIP. Up to 50 MiB total.</p>
              <ul className="mt-3 max-h-48 overflow-y-auto" aria-label="Selected files">
                {files.map((selected, index) => (
                  <li key={index} className="flex items-center gap-3 border-b border-border py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] wrap-anywhere">{selected.name}</p>
                      <p className="text-[12px] text-muted">{formatFileSize(selected.size)}</p>
                    </div>
                    <button type="button" className="grid size-11 shrink-0 place-items-center rounded-lg text-muted-strong enabled:hover:bg-surface disabled:opacity-50"
                      disabled={isLoading} aria-label={`Remove ${selected.name}`} onClick={() => removeFile(index)}><Icon name="x" /></button>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex justify-end gap-3 text-[13px] font-semibold">
                <button type="button" className="min-h-11 rounded-lg px-2 text-muted-strong disabled:opacity-50" disabled={isLoading} onClick={() => fileInput.current?.click()}>Change Files</button>
                <button type="button" className="min-h-11 rounded-lg px-2 text-muted-strong disabled:opacity-50" disabled={isLoading} onClick={() => { setFiles([]); setError(null); fileInput.current?.focus(); }}>Clear All</button>
              </div>
            </div>
          ) : file ? (
            <div className="flex min-h-48 flex-col justify-center gap-4 px-5 pt-7 pb-[18px] narrow:px-3">
              <FileSummary filename={file.name} size={file.size} variant="upload" />
              <div className="flex items-center justify-end gap-1">
                <button
                  className="
                    inline-flex items-center justify-center gap-2.5 rounded-lg border font-semibold
                    leading-[1.4] text-center no-underline transition-colors duration-150 ease-[ease]
                    motion-reduce:transition-none disabled:border-border disabled:bg-surface-subtle
                    disabled:text-muted min-h-11 px-3 py-2 text-[13px] border-transparent bg-transparent
                    text-muted-strong enabled:hover:bg-surface-subtle enabled:hover:text-foreground
                  "
                  type="button"
                  disabled={isLoading}
                  onClick={() => fileInput.current?.click()}
                >
                  Change File
                </button>
                <button
                  className="
                    inline-flex items-center justify-center gap-2.5 rounded-lg border font-semibold
                    leading-[1.4] text-center no-underline transition-colors duration-150 ease-[ease]
                    motion-reduce:transition-none disabled:border-border disabled:bg-surface-subtle
                    disabled:text-muted min-h-11 px-3 py-2 text-[13px] border-transparent bg-transparent
                    text-muted-strong enabled:hover:bg-surface-subtle enabled:hover:text-foreground
                  "
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    setFiles([]);
                    setError(null);
                    fileInput.current?.focus();
                  }}
                >
                  <Icon name="x" />Remove
                </button>
              </div>
            </div>
          ) : (
            <label className={`flex min-h-48 flex-col items-center justify-center px-4 py-6 text-center ${isLoading ? "cursor-default" : "cursor-pointer"}`} htmlFor="upload-file">
              <span className="mb-3 grid size-11 place-items-center text-brand-hover"><Icon name="arrow-up" className="size-[34px] stroke-[1.5]" /></span>
              <span className="text-[16px] font-semibold">{isDragging ? "Drop it Here" : "Drop Your Files Here"}</span>
              <span className="mt-[3px] text-[14px] text-muted">or <span className="text-brand-hover underline underline-offset-[3px]">Browse Files</span></span>
              <span className="mt-3 text-[12px] text-muted">One Link. Any Format.</span>
            </label>
          )}
        </div>
        <fieldset className="mt-6 grid min-w-0 grid-cols-2 gap-5 border-0 p-0 compact:gap-3.5 narrow:grid-cols-1 narrow:gap-4" disabled={isLoading}>
          <legend className="sr-only">Transfer Settings</legend>
          <div className="min-w-0">
            <label className="mb-2 flex items-center gap-[7px] text-[13px] font-semibold compact:gap-[5px] compact:text-[12px]" htmlFor="expiry-hours"><Icon name="clock" className="size-4 text-muted" />Expires After</label>
            <div className="
              flex items-center rounded-lg border border-border-strong bg-surface pr-3
              focus-within:outline-3 focus-within:outline-offset-3 focus-within:outline-brand
              has-[input[aria-invalid=true]]:border-danger compact:pr-2.5
            ">
              <input
                ref={expiryInput}
                id="expiry-hours"
                type="number"
                className="
                  h-[46px] w-full min-w-0 rounded-lg border-0 bg-transparent px-3 py-2.5 text-[16px]
                  font-medium text-foreground focus:outline-none disabled:text-muted compact:px-2.5
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
            <label className="mb-2 flex items-center gap-[7px] text-[13px] font-semibold compact:gap-[5px] compact:text-[12px]" htmlFor="download-limit"><Icon name="arrow-down" className="size-4 text-muted" />Download Limit</label>
            <div className="
              flex items-center rounded-lg border border-border-strong bg-surface pr-3
              focus-within:outline-3 focus-within:outline-offset-3 focus-within:outline-brand
              has-[input[aria-invalid=true]]:border-danger compact:pr-2.5
            ">
              <input
                ref={downloadsInput}
                id="download-limit"
                type="number"
                className="
                  h-[46px] w-full min-w-0 rounded-lg border-0 bg-transparent px-3 py-2.5 text-[16px]
                  font-medium text-foreground focus:outline-none disabled:text-muted compact:px-2.5
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
              <span className="pointer-events-none text-[13px] text-muted compact:text-[12px]">times</span>
            </div>
            <p className="mt-1.5 text-[12px] text-muted" id="downloads-hint">1–100 downloads</p>
          </div>
        </fieldset>
        <p className="mt-4 text-[12px] text-muted">The link closes when either limit is reached.</p>
        {error && (
          <div id="upload-error" className="
            flex items-start gap-2.5 rounded-lg border border-transparent bg-danger-soft px-4 py-[13px]
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
          disabled:text-muted border-transparent bg-action text-on-brand enabled:hover:bg-action-hover
          mt-6 min-h-[50px] w-full px-5 py-[11px]
        " disabled={isLoading || !files.length}>
          {isLoading && <Icon name="loader" className="animate-spin [animation-duration:850ms] motion-reduce:animate-none" />}
          <span>{phaseLabel}</span>
          {!isLoading && <Icon name="arrow-right" />}
        </button>
      </form>
      <span className="sr-only" role="status">{isLoading ? phaseLabel : ""}</span>
      <ul className="
        mx-auto mt-6 flex list-none flex-wrap items-center justify-center gap-x-6 gap-y-3 p-0 text-[12px]
        text-muted compact:gap-x-4 compact:gap-y-2.5 compact:text-[11px]
      " aria-label="Simple, temporary sharing">
        <li className="flex items-center gap-1.5"><Icon className="size-[15px]" name="users" />No Account</li>
        <li className="flex items-center gap-1.5"><Icon className="size-[15px]" name="lock" />Private Transfers</li>
        <li className="flex items-center gap-1.5"><Icon className="size-[15px]" name="clock" />Auto-Deleted</li>
      </ul>
    </main>
  );
}
