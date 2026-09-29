"use client";

import { useState } from "react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleUpload() {
    if (!file) {
      setMessage("Please select a file.");
      return;
    }

    setMessage("");
    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:4000/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          size: file.size,
        }),
      });

      if (!response.ok) {
        throw new Error("Presign request failed.");
      }

      const data: unknown = await response.json();

      if (
        typeof data !== "object" ||
        data === null ||
        !("key" in data) ||
        typeof data.key !== "string" ||
        !("uploadUrl" in data) ||
        typeof data.uploadUrl !== "string"
      ) {
        throw new Error("Invalid presign response.");
      }

      console.log("Presigned upload key:", data.key);

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

      setMessage("File uploaded successfully.");
    } catch {
      setMessage("Upload failed. Please try again.");
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
