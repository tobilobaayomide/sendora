import assert from "node:assert/strict";
import test from "node:test";
import {
  completeTransfer,
  createTransfer,
  getTransfer,
  requestDownload,
  revokeTransfer,
  TransferAuthorizationError,
  TransferDomainError,
} from "./api";

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("createTransfer preserves the presign contract and validates its response", async () => {
  let request: { url?: string; init?: RequestInit } = {};
  globalThis.fetch = async (input, init) => {
    request = { url: String(input), init };
    return Response.json({
      slug: "abc123",
      uploadUrl: "https://upload.example/put",
      ownerToken: "A".repeat(43),
    });
  };

  const result = await createTransfer({
    filename: "report.txt",
    contentType: "text/plain",
    size: 12,
    expiresInHours: 24,
    maxDownloads: 1,
  });

  assert.deepEqual(result, {
    slug: "abc123",
    uploadUrl: "https://upload.example/put",
    ownerToken: "A".repeat(43),
  });
  assert.equal(request.url, "http://localhost:4000/api/uploads/presign");
  assert.equal(request.init?.method, "POST");
  assert.deepEqual(JSON.parse(String(request.init?.body)), {
    filename: "report.txt",
    contentType: "text/plain",
    size: 12,
    expiresInHours: 24,
    maxDownloads: 1,
  });
});

test("createTransfer rejects malformed responses", async () => {
  globalThis.fetch = async () =>
    Response.json({
      slug: "abc",
      uploadUrl: "https://upload.example/put",
      ownerToken: "invalid",
    });
  await assert.rejects(
    createTransfer({
      filename: "report.txt",
      contentType: "text/plain",
      size: 12,
      expiresInHours: 24,
      maxDownloads: 1,
    }),
    /Invalid transfer response/,
  );
});

test("completeTransfer posts to the encoded transfer route and rejects failures", async () => {
  let requestUrl = "";
  globalThis.fetch = async (input) => {
    requestUrl = String(input);
    return new Response(null, { status: 204 });
  };
  await completeTransfer("a/b");
  assert.equal(
    requestUrl,
    "http://localhost:4000/api/transfers/a%2Fb/complete",
  );

  globalThis.fetch = async () => new Response(null, { status: 500 });
  await assert.rejects(completeTransfer("slug"), /Transfer completion failed/);
});

const transferMetadata = {
  filename: "report.txt",
  contentType: "text/plain",
  size: 12,
  expiresAt: "2030-01-02T03:04:05.000Z",
  maxDownloads: 3,
  downloadCount: 1,
};

test("getTransfer encodes the slug, disables caching, and validates public metadata", async () => {
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  const signal = new AbortController().signal;
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    requestInit = init;
    return Response.json(transferMetadata);
  };

  assert.deepEqual(await getTransfer("a/b", signal), transferMetadata);
  assert.equal(requestUrl, "http://localhost:4000/api/transfers/a%2Fb");
  assert.equal(requestInit?.cache, "no-store");
  assert.equal(requestInit?.signal, signal);
});

test("getTransfer rejects malformed metadata and maps domain response reasons", async () => {
  globalThis.fetch = async () => Response.json({ ...transferMetadata, size: -1 });
  await assert.rejects(getTransfer("slug"), /Invalid transfer metadata response/);

  for (const [status, body, reason] of [
    [404, { error: "missing" }, "missing"],
    [409, { error: "pending" }, "pending"],
    [410, { reason: "expired" }, "expired"],
    [410, { reason: "revoked" }, "revoked"],
    [410, { reason: "download_limit_reached" }, "download_limit_reached"],
    [410, { reason: "unknown" }, "unavailable"],
    [500, { error: "failure" }, "connection"],
  ] as const) {
    globalThis.fetch = async () => Response.json(body, { status });
    await assert.rejects(getTransfer("slug"), (error: unknown) =>
      error instanceof TransferDomainError && error.reason === reason,
    );
  }
});

test("requestDownload keeps admission separate from URL parsing and validates allowed URLs", async () => {
  let requestUrl = "";
  globalThis.fetch = async (input) => {
    requestUrl = String(input);
    return Response.json({ downloadUrl: "https://worker.example/download/token" });
  };

  const admission = await requestDownload("a/b");
  assert.equal(requestUrl, "http://localhost:4000/api/transfers/a%2Fb/download");

  // Reading the body is deferred so the caller can record the consumed slot first.
  let consumedSlots = 0;
  consumedSlots++;
  assert.equal(await admission.readDownloadUrl(), "https://worker.example/download/token");
  assert.equal(consumedSlots, 1);

  for (const url of [
    "http://localhost:8787/download/token",
    "http://127.0.0.1:8787/download/token",
    "http://[::1]:8787/download/token",
  ]) {
    globalThis.fetch = async () => Response.json({ downloadUrl: url });
    assert.equal(await (await requestDownload("slug")).readDownloadUrl(), url);
  }
});

test("requestDownload rejects unsafe or malformed URLs after successful admission", async () => {
  for (const url of [
    "http://downloads.example/download/token",
    "ftp://worker.example/download/token",
    "javascript:alert(1)",
    "not a URL",
    42,
  ]) {
    globalThis.fetch = async () => Response.json({ downloadUrl: url });
    const admission = await requestDownload("slug");
    await assert.rejects(admission.readDownloadUrl(), /Invalid download response/);
  }
});

test("requestDownload preserves unavailable reasons and ordinary admission failures", async () => {
  for (const [status, body, reason] of [
    [404, { error: "missing" }, "missing"],
    [409, { error: "pending" }, "pending"],
    [410, { reason: "expired" }, "expired"],
    [410, { reason: "revoked" }, "revoked"],
    [410, { reason: "download_limit_reached" }, "download_limit_reached"],
  ] as const) {
    globalThis.fetch = async () => Response.json(body, { status });
    await assert.rejects(requestDownload("slug"), (error: unknown) =>
      error instanceof TransferDomainError && error.reason === reason,
    );
  }

  globalThis.fetch = async () => Response.json({ error: "failure" }, { status: 500 });
  await assert.rejects(requestDownload("slug"), /Download admission failed/);
});

test("revokeTransfer sends the owner token and validates the success response", async () => {
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    requestInit = init;
    return Response.json({ status: "revoked", slug: "a/b" });
  };

  await revokeTransfer("a/b", "owner-secret");
  assert.equal(requestUrl, "http://localhost:4000/api/transfers/a%2Fb/revoke");
  assert.equal(requestInit?.method, "POST");
  assert.deepEqual(JSON.parse(String(requestInit?.body)), { ownerToken: "owner-secret" });

  globalThis.fetch = async () => Response.json({ status: "wrong", slug: "a/b" });
  await assert.rejects(revokeTransfer("a/b", "owner-secret"), /Invalid revocation response/);
});

test("revokeTransfer distinguishes authorization failures from ordinary failures", async () => {
  globalThis.fetch = async () => Response.json({ error: "unauthorized" }, { status: 403 });
  await assert.rejects(revokeTransfer("slug", "owner-secret"), TransferAuthorizationError);

  globalThis.fetch = async () => Response.json({ error: "failure" }, { status: 500 });
  await assert.rejects(revokeTransfer("slug", "owner-secret"), /Revocation failed/);
});
