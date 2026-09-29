"use client";

import { useState } from "react";
import { storeOwnerToken } from "@/lib/transfer-ownership";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [expiryHours, setExpiryHours] = useState("24");
  const [downloadLimit, setDownloadLimit] = useState("1");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleUpload() {
    if (!file) {
      setMessage("Please select a file.");
      return;
    }

    const expiresInHours = Number(expiryHours);
    const maxDownloads = Number(downloadLimit);

    if (!Number.isInteger(expiresInHours) || expiresInHours < 1 || expiresInHours > 168) {
      setMessage("Expiry must be an integer from 1 to 168 hours.");
      return;
    }

    if (!Number.isInteger(maxDownloads) || maxDownloads < 1 || maxDownloads > 100) {
      setMessage("Maximum downloads must be an integer from 1 to 100.");
      return;
    }

    setMessage("");
    setIsLoading(true);
    let uploadedToR2 = false;

    try {
      const response = await fetch("http://localhost:4000/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          size: file.size,
          expiresInHours,
          maxDownloads,
        }),
      });

      if (!response.ok) {
        throw new Error("Presign request failed.");
      }

      const data: unknown = await response.json();

      if (
        typeof data !== "object" ||
        data === null ||
        !("slug" in data) ||
        typeof data.slug !== "string" ||
        !("uploadUrl" in data) ||
        typeof data.uploadUrl !== "string" ||
        !("ownerToken" in data) ||
        typeof data.ownerToken !== "string" ||
        !/^[A-Za-z0-9_-]{43}$/.test(data.ownerToken)
      ) {
        throw new Error("Invalid presign response.");
      }

      if (!storeOwnerToken(data.slug, data.ownerToken)) {
        setMessage("This browser could not save transfer ownership. Upload stopped.");
        return;
      }

      console.log("Transfer slug:", data.slug);

      const uploadResponse = await fetch(data.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error("R2 upload failed.");
      }

      uploadedToR2 = true;

      const completionResponse = await fetch(
        `http://localhost:4000/transfers/${encodeURIComponent(data.slug)}/complete`,
        { method: "POST" },
      );

      if (!completionResponse.ok) {
        throw new Error("Upload completion failed.");
      }

      setMessage(`File uploaded successfully. Public identifier: /d/${data.slug}`);
    } catch {
      setMessage(
        uploadedToR2
          ? "The file was uploaded, but the transfer could not be finalized."
          : "Upload failed. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="space-y-4 p-6">
      <h1>Upload test</h1>
      <label className="block">
        Select a file
        <input
          type="file"
          className="block"
          disabled={isLoading}
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setMessage("");
          }}
        />
      </label>
      <label className="block">
        Expiry duration (hours)
        <input
          type="number"
          min={1}
          max={168}
          step={1}
          className="block border"
          value={expiryHours}
          disabled={isLoading}
          onChange={(event) => {
            setExpiryHours(event.target.value);
            setMessage("");
          }}
        />
      </label>
      <label className="block">
        Maximum downloads
        <input
          type="number"
          min={1}
          max={100}
          step={1}
          className="block border"
          value={downloadLimit}
          disabled={isLoading}
          onChange={(event) => {
            setDownloadLimit(event.target.value);
            setMessage("");
          }}
        />
      </label>
      <button
        type="button"
        className="border px-3 py-1 disabled:opacity-50"
        disabled={isLoading}
        onClick={handleUpload}
      >
        {isLoading ? "Requesting…" : "Upload"}
      </button>
      <p role="status">{message}</p>
    </main>
  );
}
