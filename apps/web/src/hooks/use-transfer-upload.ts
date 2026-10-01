import { useRef, useState } from "react";
import { prepareUpload } from "@/lib/prepare-upload";
import { storeOwnerToken } from "@/lib/transfer-ownership";
import { completeTransfer, createTransfer } from "@/lib/transfer/api";
import { uploadFile, type UploadProgress } from "@/lib/upload-file";

export type UploadPhase = "idle" | "bundling" | "preparing" | "uploading" | "finalizing" | "ready";
export type UploadError = { field: "upload"; message: string };

export function useTransferUpload() {
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [error, setError] = useState<UploadError | null>(null);
  const uploadInFlight = useRef(false);

  async function startUpload(files: readonly File[], settings: { expiresInHours: number; maxDownloads: number }): Promise<string | null> {
    if (uploadInFlight.current) return null;
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
      const transfer = await createTransfer({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
        ...settings,
      });

      if (!storeOwnerToken(transfer.slug, transfer.ownerToken)) {
        setError({ field: "upload", message: "Your browser couldn’t save ownership of this transfer. Allow site storage and try again." });
        return null;
      }

      uploadRequested = true;
      setUploadName(file.name);
      setProgress({ loadedBytes: 0, totalBytes: file.size, percentage: 0, bytesPerSecond: null, remainingSeconds: null });
      setPhase("uploading");
      await uploadFile(transfer.uploadUrl, file, setProgress);
      uploadedToR2 = true;
      setPhase("finalizing");
      await completeTransfer(transfer.slug);
      setPhase("ready");
      completed = true;
      return transfer.slug;
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
      return null;
    } finally {
      if (!completed) {
        uploadInFlight.current = false;
        setPhase("idle");
        setProgress(null);
      }
    }
  }

  function clearError() {
    setError(null);
  }

  return {
    phase,
    progress,
    uploadName,
    error,
    isBusy: phase !== "idle",
    startUpload,
    clearError,
  };
}
