import assert from "node:assert/strict";
import Module from "node:module";
import { beforeEach, test } from "node:test";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";

import { transfers } from "../db/schema";

type Row = Pick<typeof transfers.$inferSelect, "id" | "objectKey" | "expiresAt" | "revokedAt" | "exhaustedAt" | "deletedAt">;
const now = Date.now();
const hour = 3600000;
const ago = (milliseconds: number) => new Date(now - milliseconds);
const dialect = new PgDialect();
const queryDb = drizzle.mock();
let rows: Row[];
let deletedKeys: string[];
let r2Failures: Set<string>;
let dbFailures: Set<string>;
let events: string[];

function stubModule(path: string, exports: unknown) {
  const id = require.resolve(path);
  const module = new Module(id);
  module.exports = exports;
  module.loaded = true;
  require.cache[id] = module;
}

function earliest(row: Row) {
  return Math.min(...[row.expiresAt, row.revokedAt, row.exhaustedAt]
    .filter((date): date is Date => date !== null).map(date => date.getTime()));
}

stubModule("../config/env", { env: { R2_BUCKET_NAME: "test-bucket" } });
stubModule("../lib/r2", { r2: { send: async (command: DeleteObjectCommand) => {
  assert.ok(command instanceof DeleteObjectCommand);
  assert.equal(command.input.Bucket, "test-bucket");
  const key = command.input.Key!;
  events.push(`delete:${key}`);
  if (r2Failures.has(key)) throw new Error("R2 unavailable");
  deletedKeys.push(key);
  return {}; // Also represents R2's successful deletion of an already-missing object.
} } });
stubModule("../db", { db: {
  select: () => ({ from: () => ({ where: (condition: SQL) => ({ orderBy: (...order: SQL[]) => ({ limit: async (limit: number) => {
    const query = queryDb.select({ id: transfers.id, objectKey: transfers.objectKey }).from(transfers)
      .where(condition).orderBy(...order).limit(limit).toSQL();
    assert.ok(query.sql.includes('"transfers"."deleted_at" is null'));
    assert.ok(query.sql.includes('least("transfers"."expires_at", "transfers"."revoked_at", "transfers"."exhausted_at") <= now() - interval \'1 hour\''));
    assert.ok(query.sql.includes('order by least('));
    assert.equal(limit, 100);
    assert.equal(query.params.at(-1), 100);
    return rows.filter(row => row.deletedAt === null && earliest(row) <= now - hour)
      .sort((a, b) => earliest(a) - earliest(b)).slice(0, limit)
      .map(({ id, objectKey }) => ({ id, objectKey }));
  } }) }) }) }),
  update: () => ({ set: (values: { deletedAt: SQL }) => ({ where: async (condition: SQL) => {
    assert.deepEqual(Object.keys(values), ["deletedAt"]);
    assert.equal(dialect.sqlToQuery(values.deletedAt).sql, "clock_timestamp()");
    const query = dialect.sqlToQuery(condition);
    assert.match(query.sql, /"transfers"\."id" = \$1/);
    assert.ok(query.sql.includes('"transfers"."deleted_at" is null'));
    const row = rows.find(row => row.id === query.params[0]);
    assert.ok(row);
    assert.ok(deletedKeys.includes(row.objectKey), "R2 must succeed before the marker write");
    events.push(`mark:${row.objectKey}`);
    if (dbFailures.has(row.id)) throw new Error("Database unavailable");
    row.deletedAt ??= new Date(now);
  } }) }),
} });

const { cleanupTransfers } = require("./cleanup") as typeof import("./cleanup");

function transfer(overrides: Partial<Row> = {}): Row {
  return { id: "transfer-1", objectKey: "uploads/object-1", expiresAt: new Date(now + hour),
    revokedAt: null, exhaustedAt: null, deletedAt: null, ...overrides };
}

beforeEach(() => {
  rows = []; deletedKeys = []; events = []; r2Failures = new Set(); dbFailures = new Set();
});

for (const field of ["expiresAt", "revokedAt", "exhaustedAt"] as const) {
  test(`cleans an eligible transfer terminal through ${field}`, async () => {
    rows = [transfer({ [field]: ago(2 * hour) })];
    assert.deepEqual(await cleanupTransfers(), { selected: 1, deleted: 1, failed: 0 });
    assert.ok(rows[0].deletedAt instanceof Date);
    assert.deepEqual(events, ["delete:uploads/object-1", "mark:uploads/object-1"]);
  });
}

test("uses the earliest terminal event, including when expiry is still in the future", async () => {
  rows = [transfer({ revokedAt: ago(2 * hour), exhaustedAt: ago(10 * 60000) })];
  assert.equal((await cleanupTransfers()).deleted, 1);
});

test("does not clean active or grace-period transfers, but includes the exact one-hour boundary", async () => {
  rows = [
    transfer(),
    transfer({ id: "recent-expiry", expiresAt: ago(hour - 1) }),
    transfer({ id: "recent-revoke", revokedAt: ago(hour - 1) }),
    transfer({ id: "recent-exhaustion", exhaustedAt: ago(hour - 1) }),
    transfer({ id: "boundary", objectKey: "uploads/boundary", revokedAt: ago(hour) }),
  ];
  assert.deepEqual(await cleanupTransfers(), { selected: 1, deleted: 1, failed: 0 });
  assert.deepEqual(deletedKeys, ["uploads/boundary"]);
});

test("ignores already deleted transfers", async () => {
  rows = [transfer({ expiresAt: ago(2 * hour), deletedAt: ago(hour) })];
  assert.deepEqual(await cleanupTransfers(), { selected: 0, deleted: 0, failed: 0 });
  assert.deepEqual(deletedKeys, []);
});

test("continues after R2 failure and retries the failed object on the next run", async () => {
  rows = [transfer({ expiresAt: ago(2 * hour) }), transfer({ id: "second", objectKey: "uploads/second", revokedAt: ago(2 * hour) })];
  r2Failures.add(rows[0].objectKey);
  assert.deepEqual(await cleanupTransfers(), { selected: 2, deleted: 1, failed: 1 });
  assert.equal(rows[0].deletedAt, null);
  assert.ok(rows[1].deletedAt);
  r2Failures.clear();
  assert.deepEqual(await cleanupTransfers(), { selected: 1, deleted: 1, failed: 0 });
  assert.ok(rows[0].deletedAt);
});

test("retries safely when deletion succeeds but the database marker write fails", async () => {
  rows = [transfer({ expiresAt: ago(2 * hour) })];
  dbFailures.add(rows[0].id);
  assert.deepEqual(await cleanupTransfers(), { selected: 1, deleted: 0, failed: 1 });
  assert.equal(rows[0].deletedAt, null);
  dbFailures.clear();
  assert.deepEqual(await cleanupTransfers(), { selected: 1, deleted: 1, failed: 0 });
  assert.equal(deletedKeys.length, 2);
});

test("bounds each run to 100 candidates", async () => {
  rows = Array.from({ length: 101 }, (_, index) => transfer({ id: String(index), objectKey: `uploads/${index}`, expiresAt: ago(2 * hour) }));
  assert.deepEqual(await cleanupTransfers(), { selected: 100, deleted: 100, failed: 0 });
  assert.equal(rows.filter(row => row.deletedAt === null).length, 1);
});
