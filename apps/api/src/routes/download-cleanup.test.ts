import assert from "node:assert/strict";
import Module from "node:module";
import { after, beforeEach, test } from "node:test";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import Fastify from "fastify";

import { transfers } from "../db/schema";

type Row = typeof transfers.$inferSelect;
let row: Row;
let signingFails: boolean;
let signingCalls: number;
let exists: boolean;
let observedTime: number;
let pending = Promise.resolve();
const queryDb = drizzle.mock();

function stubModule(path: string, exports: unknown) {
  const id = require.resolve(path);
  const module = new Module(id);
  module.exports = exports;
  module.loaded = true;
  require.cache[id] = module;
}

stubModule("../config/env", { env: { R2_BUCKET_NAME: "test-bucket" } });
stubModule("../lib/r2", { r2: {} });
stubModule("@aws-sdk/s3-request-presigner", { getSignedUrl: async (_client: unknown, command: GetObjectCommand) => {
  signingCalls++;
  assert.ok(command instanceof GetObjectCommand);
  await new Promise(resolve => setImmediate(resolve));
  if (signingFails) throw new Error("Signing failed");
  return "https://example.invalid/download";
} });
stubModule("../db", { db: {
  select: () => ({ from: () => ({ where: () => ({ limit: async () =>
    exists ? [{ ...row, observedAt: observedTime }] : [] }) }) }),
  transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
    // Model row serialization and rollback; verify the real SQL predicates below.
    const previous = pending;
    let release!: () => void;
    pending = new Promise(resolve => { release = resolve; });
    await previous;
    const working = { ...row };
    const tx = {
      update: () => ({ set: (changes: { downloadCount: SQL; exhaustedAt: SQL }) => ({ where: (condition: SQL) => ({ returning: async () => {
        const query = queryDb.update(transfers).set(changes).where(condition).toSQL();
        const normalized = query.sql.replace(/\s+/g, " ");
        assert.ok(normalized.includes('"download_count" = "transfers"."download_count" + 1'));
        assert.ok(normalized.includes('"exhausted_at" = coalesce("transfers"."exhausted_at", case when "transfers"."download_count" + 1 >= "transfers"."max_downloads" then clock_timestamp() end)'));
        for (const predicate of ['"transfers"."slug" = $1', '"transfers"."uploaded_at" is not null',
          '"transfers"."revoked_at" is null', '"transfers"."expires_at" > clock_timestamp()',
          '"transfers"."download_count" < "transfers"."max_downloads"']) {
          assert.ok(normalized.includes(predicate));
        }
        assert.deepEqual(query.params, [working.slug]);
        if (!exists || working.uploadedAt === null || working.revokedAt !== null ||
            working.expiresAt.getTime() <= observedTime || working.downloadCount >= working.maxDownloads) return [];
        working.downloadCount++;
        if (working.downloadCount >= working.maxDownloads) working.exhaustedAt ??= new Date();
        return [{ ...working }];
      } }) }) }),
      select: () => ({ from: () => ({ where: () => ({ limit: async () => exists ? [{ ...working, observedAt: observedTime }] : [] }) }) }),
    };
    try {
      const result = await callback(tx);
      row = working;
      return result;
    } finally { release(); }
  },
} });

const { transferRoutes } = require("./transfers") as typeof import("./transfers");
const app = Fastify({ logger: false });
app.register(transferRoutes);
after(() => app.close());
beforeEach(() => {
  observedTime = Date.now();
  exists = true;
  signingCalls = 0;
  row = { id: "internal-id", ownerTokenHash: "internal-hash", contentType: "text/plain", size: 12,
    createdAt: new Date(), deletedAt: null, slug: "test-slug", objectKey: "uploads/test", originalName: "test.txt", uploadedAt: new Date(),
    revokedAt: null, expiresAt: new Date(Date.now() + 3600000), downloadCount: 0, maxDownloads: 1, exhaustedAt: null };
  signingFails = false;
});
const download = () => app.inject({ method: "POST", url: "/transfers/test-slug/download" });

test("final download atomically sets exhaustedAt with the count", async () => {
  const before = Date.now();
  assert.equal((await download()).statusCode, 200);
  assert.equal(row.downloadCount, 1);
  assert.ok(row.exhaustedAt instanceof Date);
  assert.ok(row.exhaustedAt.getTime() >= before);
});

test("non-final download leaves exhaustedAt unset", async () => {
  row.maxDownloads = 2;
  assert.equal((await download()).statusCode, 200);
  assert.equal(row.downloadCount, 1);
  assert.equal(row.exhaustedAt, null);
});

test("an existing exhaustion timestamp is preserved", async () => {
  const original = new Date(Date.now() - 5000);
  row.exhaustedAt = original;
  assert.equal((await download()).statusCode, 200);
  assert.equal(row.exhaustedAt, original);
});

test("signing failure rolls back both the increment and exhaustion timestamp", async () => {
  signingFails = true;
  assert.equal((await download()).statusCode, 500);
  assert.equal(row.downloadCount, 0);
  assert.equal(row.exhaustedAt, null);
});

test("simultaneous final-slot requests admit one download and record one exhaustion", async () => {
  const responses = await Promise.all([download(), download()]);
  assert.deepEqual(responses.map(response => response.statusCode).sort(), [200, 410]);
  assert.equal(row.downloadCount, 1);
  assert.ok(row.exhaustedAt instanceof Date);
  const timestamp = row.exhaustedAt;
  assert.equal((await download()).statusCode, 410);
  assert.equal(row.exhaustedAt, timestamp);
});


const metadata = () => app.inject({ method: "GET", url: "/transfers/test-slug" });
for (const [endpoint, request] of [["metadata", metadata], ["download", download]] as const) {
  const cases = [
    { name: "expired", changes: () => ({ expiresAt: new Date(observedTime - 3000) }), reason: "expired" },
    { name: "revoked", changes: () => ({ revokedAt: new Date(observedTime - 3000) }), reason: "revoked" },
    { name: "exhausted", changes: () => ({ downloadCount: 1, exhaustedAt: new Date(observedTime - 3000) }), reason: "download_limit_reached" },
    { name: "earlier expiry wins over revocation/exhaustion", changes: () => ({
      expiresAt: new Date(observedTime - 3000), revokedAt: new Date(observedTime - 2000),
      downloadCount: 1, exhaustedAt: new Date(observedTime - 1000),
    }), reason: "expired" },
    { name: "earlier revocation wins over expiry/exhaustion", changes: () => ({
      revokedAt: new Date(observedTime - 3000), expiresAt: new Date(observedTime - 2000),
      downloadCount: 1, exhaustedAt: new Date(observedTime - 1000),
    }), reason: "revoked" },
    { name: "earlier exhaustion wins over expiry/revocation", changes: () => ({
      downloadCount: 1, exhaustedAt: new Date(observedTime - 3000),
      expiresAt: new Date(observedTime - 2000), revokedAt: new Date(observedTime - 1000),
    }), reason: "download_limit_reached" },
    { name: "timestamp ties prefer revoked", changes: () => ({
      downloadCount: 1, exhaustedAt: new Date(observedTime), expiresAt: new Date(observedTime), revokedAt: new Date(observedTime),
    }), reason: "revoked" },
    { name: "expiry wins a tie with exhaustion", changes: () => ({
      downloadCount: 1, exhaustedAt: new Date(observedTime), expiresAt: new Date(observedTime),
    }), reason: "expired" },
    { name: "historical exhaustion without a timestamp", changes: () => ({ downloadCount: 1 }), reason: "download_limit_reached" },
    { name: "known expiry preferred over undated historical exhaustion", changes: () => ({
      downloadCount: 1, expiresAt: new Date(observedTime - 1000),
    }), reason: "expired" },
    { name: "known revocation preferred over undated historical exhaustion", changes: () => ({
      downloadCount: 1, revokedAt: new Date(observedTime - 1000),
    }), reason: "revoked" },
    { name: "expiry uses database time", changes: () => {
      observedTime += 120000;
      return { expiresAt: new Date(observedTime - 1000) };
    }, reason: "expired" },
  ] satisfies { name: string; changes: () => Partial<Row>; reason: string }[];

  for (const scenario of cases) {
    test(`${endpoint}: ${scenario.name}`, async () => {
      Object.assign(row, scenario.changes());
      const before = { ...row };
      const response = await request();
      assert.equal(response.statusCode, 410);
      assert.deepEqual(response.json(), { error: "transfer_unavailable", reason: scenario.reason });
      assert.deepEqual(row, before);
      assert.equal(signingCalls, 0);
    });
  }

  test(`${endpoint}: missing and pending keep their precedence`, async () => {
    exists = false;
    assert.equal((await request()).statusCode, 404);
    exists = true;
    row.uploadedAt = null;
    row.revokedAt = new Date(observedTime - 2000);
    row.expiresAt = new Date(observedTime - 1000);
    const response = await request();
    assert.equal(response.statusCode, 409);
    assert.equal(response.json().reason, undefined);
    assert.equal(signingCalls, 0);
  });
}

test("available metadata retains only its public fields and consumes no download", async () => {
  const response = await metadata();
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    slug: row.slug, filename: row.originalName, contentType: row.contentType, size: row.size,
    expiresAt: row.expiresAt.toISOString(), maxDownloads: row.maxDownloads, downloadCount: 0,
  });
  assert.equal(row.downloadCount, 0);
  assert.equal(signingCalls, 0);
});

test("expiry during signing returns expired and rolls back admission", async (t) => {
  row.expiresAt = new Date(Date.now() + 2000);
  t.mock.method(Date, "now", () => row.expiresAt.getTime() + 1);
  const response = await download();
  assert.equal(response.statusCode, 410);
  assert.deepEqual(response.json(), { error: "transfer_unavailable", reason: "expired" });
  assert.equal(row.downloadCount, 0);
  assert.equal(row.exhaustedAt, null);
});

test("an elapsed signed URL lifetime must not falsely imply transfer expiry", async (t) => {
  const later = Date.now() + 301000;
  t.mock.method(Date, "now", () => later);
  const response = await download();
  assert.equal(response.statusCode, 410);
  assert.deepEqual(response.json(), { error: "transfer_unavailable" });
  assert.equal(row.downloadCount, 0);
  assert.equal(row.exhaustedAt, null);
});
