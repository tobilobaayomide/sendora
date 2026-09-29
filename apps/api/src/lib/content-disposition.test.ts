import assert from "node:assert/strict";
import { test } from "node:test";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { attachmentDisposition } from "./content-disposition";

function extendedFilename(header: string) {
  return decodeURIComponent(header.split("filename*=UTF-8''")[1]);
}

test("preserves ordinary filenames and UTF-8 names", () => {
  for (const filename of ["holiday photo (1)-edited_final.png", "résumé-日本語 😀.pdf", "it's (final)*.txt"]) {
    const header = attachmentDisposition(filename);
    assert.match(header, /^attachment; filename="[A-Za-z0-9 .()_-]+"; filename\*=UTF-8''/);
    assert.equal(extendedFilename(header), filename);
    assert.ok([...header].every((character) => character.charCodeAt(0) < 128));
  }
  assert.ok(attachmentDisposition("file (1).pdf").includes('filename="file (1).pdf"'));
  assert.ok(attachmentDisposition("it's (final)*.txt").endsWith("it%27s%20%28final%29%2A.txt"));
});

test("neutralizes header injection, controls, and path separators", () => {
  const header = attachmentDisposition('folder/evil\\name";\r\nX-Injected: yes\u0000.pdf');
  assert.equal(extendedFilename(header), 'folder_evil_name";__X-Injected: yes_.pdf');
  assert.ok(!/[\r\n\u0000]/.test(header));
  const fallback = header.match(/filename="([^"]*)"/)?.[1];
  assert.ok(fallback);
  assert.ok(!/[";\\/]/.test(fallback));
});

test("handles empty, dot-only, and malformed Unicode names", () => {
  for (const filename of ["", " ", ".", ".."]) {
    assert.equal(extendedFilename(attachmentDisposition(filename)), "download");
  }
  assert.equal(extendedFilename(attachmentDisposition("bad\ud800.txt")), "bad\ufffd.txt");
});

test("signs the response disposition override without changing content type or expiry", async () => {
  const client = new S3Client({
    region: "auto",
    endpoint: "https://example.r2.cloudflarestorage.com",
    credentials: { accessKeyId: "test-access-key", secretAccessKey: "test-secret-key" },
  });
  try {
    const options = { expiresIn: 123, signingDate: new Date("2026-09-29T12:00:00Z") };
    const input = { Bucket: "test-bucket", Key: "uploads/test-object" };
    const disposition = attachmentDisposition("résumé (final).pdf");
    const signed = new URL(await getSignedUrl(client, new GetObjectCommand({
      ...input,
      ResponseContentDisposition: disposition,
    }), options));
    const withoutOverride = new URL(await getSignedUrl(client, new GetObjectCommand(input), options));

    assert.equal(signed.searchParams.get("response-content-disposition"), disposition);
    assert.equal(signed.searchParams.has("response-content-type"), false);
    assert.equal(signed.searchParams.get("X-Amz-Expires"), "123");
    assert.equal(signed.searchParams.get("X-Amz-Date"), "20260929T120000Z");
    assert.ok(signed.searchParams.has("X-Amz-Signature"));
    assert.notEqual(signed.searchParams.get("X-Amz-Signature"), withoutOverride.searchParams.get("X-Amz-Signature"));
  } finally {
    client.destroy();
  }
});
