export const BUNDLE_NAME = "sendora-files.zip";
export const BUNDLE_TYPE = "application/zip";
// ZIP generation retains inputs and output in memory. Leave headroom for copies
// and the rest of the page on mobile devices; single files bypass this limit.
export const MAX_BUNDLE_BYTES = 50 * 1024 * 1024;
export const MAX_BUNDLE_FILES = 500;

export function selectionError(files: readonly File[]): string | null {
  if (!files.length) return "Choose a file to send.";
  if (files.length === 1 && files[0].size === 0) return "This file is empty. Choose a file with something in it.";
  if (files.length > MAX_BUNDLE_FILES) return "Choose up to 500 files per ZIP transfer.";
  if (files.length > 1 && files.reduce((total, file) => total + file.size, 0) > MAX_BUNDLE_BYTES) {
    return "Multiple files must total 50 MiB or less to bundle safely in your browser. Choose fewer files, or send a single file.";
  }
  return null;
}

export function archiveNames(files: readonly Pick<File, "name">[]): string[] {
  const used = new Set<string>();
  return files.map(({ name }) => {
    // Flat entries only, including Windows paths; replace control characters and
    // Windows-special punctuation so common extractors can safely save the file.
    let safe = name.normalize("NFC").trim().replace(/[\\/<>:"|?*\u0000-\u001f\u007f]/g, "_")
      .replace(/^\.+|[. ]+$/g, "") || "file";
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(safe)) safe = `_${safe}`;
    const dot = safe.lastIndexOf(".");
    const stem = dot > 0 ? safe.slice(0, dot) : safe;
    const extension = dot > 0 ? safe.slice(dot) : "";
    let candidate = safe;
    let suffix = 2;
    while (used.has(candidate.toLowerCase())) candidate = `${stem} (${suffix++})${extension}`;
    used.add(candidate.toLowerCase());
    return candidate;
  });
}

export async function prepareUpload(files: readonly File[]): Promise<File> {
  const error = selectionError(files);
  if (error) throw new Error(error);
  if (files.length === 1) return files[0];

  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const names = archiveNames(files);
  // Read sequentially; avoid starting hundreds of File reads simultaneously.
  for (const [index, file] of files.entries()) {
    zip.file(names[index], await file.arrayBuffer(), { binary: true });
  }
  const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
  return new File([blob], BUNDLE_NAME, { type: BUNDLE_TYPE });
}

// Current public metadata has no bundle flag/manifest. This convention is a UI
// hint only: a separately uploaded ZIP with this same name/type looks identical.
export function isSendoraBundle(filename: string, contentType: string): boolean {
  return filename === BUNDLE_NAME && contentType === BUNDLE_TYPE;
}
