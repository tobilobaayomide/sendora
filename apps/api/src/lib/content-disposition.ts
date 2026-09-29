export function attachmentDisposition(originalName: string): string {
  // Replace malformed Unicode, control characters, and path separators.
  const cleaned = Buffer.from(originalName, "utf8").toString("utf8")
    .replace(/[\u0000-\u001f\u007f-\u009f/\\]/g, "_")
    .trim();
  const filename = !cleaned || cleaned === "." || cleaned === ".." ? "download" : cleaned;

  // Keep the quoted fallback ASCII-only; filename* preserves Unicode via RFC 5987.
  const fallback = filename.replace(/[^A-Za-z0-9 .()_-]/g, "_");
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
