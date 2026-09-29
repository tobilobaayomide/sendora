import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import Module from "node:module";
import { after, beforeEach, test } from "node:test";
import { S3Client } from "@aws-sdk/client-s3";
import { PgDialect } from "drizzle-orm/pg-core";
import Fastify from "fastify";

import { transfers } from "../db/schema";
import { createOwnerToken, verifyOwnerToken } from "../lib/owner-token";

type Transfer = typeof transfers.$inferSelect;
type Insert = typeof transfers.$inferInsert;
let row: Transfer | undefined;
let inserted: Insert | undefined;
let writes = 0;
let databaseError: Error | undefined;
const dialect = new PgDialect();
const owner = createOwnerToken();

function stubModule(path: string, exports: unknown) {
  const id = require.resolve(path);
  const module = new Module(id);
  module.exports = exports;
  module.loaded = true;
  require.cache[id] = module;
}

stubModule("../config/env", { env: { R2_BUCKET_NAME: "test-bucket" } });
const client = new S3Client({
  region: "auto",
  endpoint: "https://example.r2.cloudflarestorage.com",
  credentials: { accessKeyId: "test-access", secretAccessKey: "test-secret" },
});
stubModule("../lib/r2", { r2: client });
stubModule("../db", { db: {
  insert: () => ({ values: async (values: Insert) => {
    if (databaseError) throw databaseError;
    inserted = values;
  } }),
  select: () => ({ from: () => ({ where: (condition: Parameters<typeof dialect.sqlToQuery>[0]) => {
    const query = dialect.sqlToQuery(condition);
    assert.match(query.sql, /"transfers"\."slug" = \$1/);
    return { limit: async () => {
      if (databaseError) throw databaseError;
      return row && query.params[0] === row.slug ? [{ ...row, observedAt: Date.now() }] : [];
    } };
  } }) }),
  update: () => ({ set: (changes: { revokedAt: Parameters<typeof dialect.sqlToQuery>[0] }) => {
    assert.deepEqual(Object.keys(changes), ["revokedAt"]);
    assert.equal(dialect.sqlToQuery(changes.revokedAt).sql, 'coalesce("transfers"."revoked_at", clock_timestamp())');
    return { where: (condition: Parameters<typeof dialect.sqlToQuery>[0]) => {
      const query = dialect.sqlToQuery(condition);
      assert.match(query.sql, /"transfers"\."id" = \$1/);
      return { returning: async () => {
        if (databaseError) throw databaseError;
        if (!row || query.params[0] !== row.id) return [];
        row.revokedAt ??= new Date();
        writes++;
        return [{ id: row.id }];
      } };
    } };
  } }),
} });

const { uploadRoutes } = require("./uploads") as typeof import("./uploads");
const { transferRoutes } = require("./transfers") as typeof import("./transfers");
const logs: string[] = [];
const app = Fastify({ logger: { stream: { write: (line: string) => { logs.push(line); } } } });
app.register(uploadRoutes);
app.register(transferRoutes);
after(async () => { await app.close(); client.destroy(); });

beforeEach(() => {
  row = {
    id: "00000000-0000-4000-8000-000000000001", slug: "public-slug",
    ownerTokenHash: owner.ownerTokenHash, objectKey: "uploads/private-key",
    originalName: "example.txt", contentType: "text/plain", size: 12,
    createdAt: new Date(), expiresAt: new Date(Date.now() + 3600000),
    uploadedAt: new Date(), revokedAt: null, downloadCount: 0, maxDownloads: 1,
    exhaustedAt: null, deletedAt: null,
  };
  inserted = undefined; writes = 0; databaseError = undefined; logs.length = 0;
});

function revoke(ownerToken: string, slug = "public-slug") {
  return app.inject({ method: "POST", url: `/transfers/${slug}/revoke`, payload: { ownerToken } });
}

const uploadBody = {
  filename: "example.txt", contentType: "text/plain", size: 12,
  expiresInHours: 24, maxDownloads: 1,
};

test("creation returns an independent owner token and persists only its SHA-256 hash", async () => {
  const response = await app.inject({ method: "POST", url: "/uploads/presign", payload: uploadBody });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.deepEqual(Object.keys(body).sort(), ["ownerToken", "slug", "uploadUrl"]);
  assert.match(body.ownerToken, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(body.ownerToken, body.slug);
  assert.ok(inserted);
  assert.equal(inserted.ownerTokenHash, createHash("sha256").update(body.ownerToken).digest("hex"));
  assert.ok(!JSON.stringify(inserted).includes(body.ownerToken));
  assert.equal(response.headers["cache-control"], "no-store");
  assert.ok(!logs.join("").includes(body.ownerToken));
  assert.ok(!logs.join("").includes(inserted.ownerTokenHash));
});

test("correct token revokes and repeated revocation preserves the timestamp", async () => {
  assert.ok(row);
  const before = Date.now();
  const response = await revoke(owner.ownerToken);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "revoked", slug: "public-slug" });
  assert.ok(row.revokedAt instanceof Date);
  assert.ok(row.revokedAt.getTime() >= before);
  const timestamp = row.revokedAt;
  assert.equal((await revoke(owner.ownerToken)).statusCode, 200);
  assert.equal(row.revokedAt, timestamp);
  assert.equal(writes, 1);
  assert.ok(!logs.join("").includes(owner.ownerToken));
  assert.ok(!logs.join("").includes(owner.ownerTokenHash));
});

test("wrong token and missing transfer return indistinguishable authorization failures", async () => {
  const wrong = await revoke(createOwnerToken().ownerToken);
  const missing = await revoke(owner.ownerToken, "missing-slug");
  assert.equal(wrong.statusCode, 403);
  assert.equal(missing.statusCode, 403);
  assert.deepEqual(wrong.json(), missing.json());
  assert.equal(row?.revokedAt, null);
  assert.equal(writes, 0);
});

test("public slug alone, missing tokens, malformed tokens, and the hash cannot revoke", async () => {
  for (const payload of [undefined, {}, { ownerToken: "public-slug" },
    { ownerToken: 12 }, { ownerToken: "" }, { ownerToken: owner.ownerTokenHash }]) {
    const response = await app.inject({ method: "POST", url: "/transfers/public-slug/revoke", payload });
    assert.equal(response.statusCode, 403);
  }
  assert.equal(row?.revokedAt, null);
  assert.equal(writes, 0);
});

test("incorrect token still fails after the transfer has been revoked", async () => {
  await revoke(owner.ownerToken);
  assert.equal((await revoke(createOwnerToken().ownerToken)).statusCode, 403);
  assert.equal(writes, 1);
});

test("concurrent owner revocations succeed without changing the first timestamp", async () => {
  const responses = await Promise.all([revoke(owner.ownerToken), revoke(owner.ownerToken)]);
  assert.deepEqual(responses.map(response => response.statusCode), [200, 200]);
  const timestamp = row?.revokedAt;
  await revoke(owner.ownerToken);
  assert.equal(row?.revokedAt, timestamp);
});

test("owner tokens and hashes stay out of public metadata", async () => {
  const response = await app.inject({ method: "GET", url: "/transfers/public-slug" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(Object.keys(response.json()).sort(), [
    "contentType", "downloadCount", "expiresAt", "filename", "maxDownloads", "size", "slug",
  ]);
});

test("database failures expose neither SQL parameters nor secrets in responses or logs", async () => {
  databaseError = new Error(`SQL params: ${owner.ownerTokenHash} ${owner.ownerToken}`);
  const responses = [
    await revoke(owner.ownerToken),
    await app.inject({ method: "POST", url: "/uploads/presign", payload: uploadBody }),
  ];
  for (const response of responses) {
    assert.equal(response.statusCode, 500);
    assert.ok(!response.body.includes(owner.ownerToken));
    assert.ok(!response.body.includes(owner.ownerTokenHash));
  }
  assert.ok(!logs.join("").includes(owner.ownerToken));
  assert.ok(!logs.join("").includes(owner.ownerTokenHash));
});

test("token verification handles missing/invalid hashes and tokens are independent", () => {
  const another = createOwnerToken();
  assert.notEqual(another.ownerToken, owner.ownerToken);
  assert.equal(verifyOwnerToken(owner.ownerToken, owner.ownerTokenHash), true);
  assert.equal(verifyOwnerToken(another.ownerToken, owner.ownerTokenHash), false);
  assert.equal(verifyOwnerToken(owner.ownerToken, undefined), false);
  assert.equal(verifyOwnerToken(owner.ownerToken, "invalid-hash"), false);
});
