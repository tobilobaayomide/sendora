import assert from "node:assert/strict";
import Module from "node:module";
import { after, beforeEach, test } from "node:test";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import Fastify from "fastify";

import { transfers } from "../db/schema";

type Row = Pick<typeof transfers.$inferSelect, "slug" | "objectKey" | "originalName" | "uploadedAt" | "revokedAt" | "expiresAt" | "downloadCount" | "maxDownloads" | "exhaustedAt">;
let row: Row;
let signingFails: boolean;
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
  assert.ok(command instanceof GetObjectCommand);
  await new Promise(resolve => setImmediate(resolve));
  if (signingFails) throw new Error("Signing failed");
  return "https://example.invalid/download";
} });
stubModule("../db", { db: {
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
        if (working.downloadCount >= working.maxDownloads) return [];
        working.downloadCount++;
        if (working.downloadCount >= working.maxDownloads) working.exhaustedAt ??= new Date();
        return [{ ...working }];
      } }) }) }),
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ ...working }] }) }) }),
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
  row = { slug: "test-slug", objectKey: "uploads/test", originalName: "test.txt", uploadedAt: new Date(),
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
