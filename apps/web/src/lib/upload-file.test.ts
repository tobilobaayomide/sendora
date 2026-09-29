import assert from "node:assert/strict";
import { test } from "node:test";
import { createProgressTracker, formatUploadEta, uploadFile } from "./upload-file";
import { formatFileSize } from "./format-file-size";

test("bytes and percentage come from measured progress and clamp safely", () => {
  const track = createProgressTracker(1000, 0);
  assert.equal(track(250, 100).percentage, 25);
  assert.equal(track(250, 400).percentage, 25);
  assert.equal(track(1500, 500).percentage, 100);
  assert.equal(track(-1, 600).loadedBytes, 0);
  assert.equal(createProgressTracker(0, 0)(0, 1000).percentage, 0);
  assert.equal(formatFileSize(32700000), "32.7 MB");
});

test("speed samples are smoothed; ETA waits for useful measurements", () => {
  const track = createProgressTracker(10000, 0);
  assert.equal(track(100, 100).bytesPerSecond, null);
  const first = track(1000, 1000);
  assert.equal(first.bytesPerSecond, 1000);
  assert.equal(first.remainingSeconds, null);
  const next = track(3000, 2000);
  assert.equal(next.bytesPerSecond, 1250);
  assert.equal(next.remainingSeconds, 5.6);
  assert.equal(formatUploadEta(next.remainingSeconds), "About 6 sec remaining");
  assert.equal(track(3100, 2100).bytesPerSecond, 1250);
  assert.equal(track(10000, 3000).remainingSeconds, null);
});

test("zero or invalid rates never produce invalid ETA", () => {
  const track = createProgressTracker(1000, 0);
  assert.equal(track(0, 1000).bytesPerSecond, null);
  assert.equal(track(0, 2000).remainingSeconds, null);
  for (const value of [null, 0, -1, NaN, Infinity, 86401]) assert.equal(formatUploadEta(value), null);
  assert.equal(formatUploadEta(90), "About 2 min remaining");
});

class MockXHR {
  static last: MockXHR;
  upload = { onprogress: null as ((event: { loaded: number }) => void) | null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  status = 200;
  method = "";
  headers: Record<string, string> = {};
  body: Blob | null = null;
  constructor() { MockXHR.last = this; }
  open(method: string) { this.method = method; }
  setRequestHeader(name: string, value: string) { this.headers[name] = value; }
  send(body: Blob) { this.body = body; }
}

test("XHR sends original body and type, reports bytes, and waits for successful response", async () => {
  const previous = globalThis.XMLHttpRequest;
  globalThis.XMLHttpRequest = MockXHR as unknown as typeof XMLHttpRequest;
  try {
    const file = new File(["abcdef"], "archive.zip", { type: "application/zip" });
    const updates: number[] = [];
    let resolved = false;
    const promise = uploadFile("https://example.test", file, (p) => { updates.push(p.percentage); assert.equal(p.totalBytes, file.size); }).then(() => { resolved = true; });
    const xhr = MockXHR.last;
    assert.equal(xhr.method, "PUT");
    assert.equal(xhr.body, file);
    assert.equal(xhr.headers["Content-Type"], "application/zip");
    xhr.upload.onprogress!({ loaded: 3 });
    xhr.upload.onprogress!({ loaded: 6 });
    await Promise.resolve();
    assert.equal(resolved, false);
    assert.deepEqual(updates, [50, 100]);
    xhr.onload!();
    await promise;
    assert.equal(resolved, true);
    assert.equal(xhr.upload.onprogress, null);
  } finally { globalThis.XMLHttpRequest = previous; }
});

for (const failure of ["http", "network", "abort", "timeout"] as const) {
  test(`XHR rejects ${failure} failure with a generic error`, async () => {
    const previous = globalThis.XMLHttpRequest;
    globalThis.XMLHttpRequest = MockXHR as unknown as typeof XMLHttpRequest;
    try {
      const promise = uploadFile("https://example.test", new Blob(["x"]), () => {});
      const xhr = MockXHR.last;
      assert.equal(xhr.headers["Content-Type"], "application/octet-stream");
      if (failure === "http") { xhr.status = 403; xhr.onload!(); }
      else if (failure === "network") xhr.onerror!();
      else if (failure === "abort") xhr.onabort!();
      else xhr.ontimeout!();
      await assert.rejects(promise, { message: "File upload failed." });
      assert.equal(xhr.onload, null);
    } finally { globalThis.XMLHttpRequest = previous; }
  });
}
