import assert from "node:assert/strict";
import Module from "node:module";
import { after, beforeEach, test } from "node:test";
import { eq, SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import Fastify from "fastify";

import { downloadSessions, transfers } from "../db/schema";
import { createDownloadToken, hashDownloadToken } from "../lib/download-token";

type Session = {
  bootstrapTokenHash: string;
  sessionTokenHash: string | null;
  claimedAt: Date | null;
  expiresAt: Date;
};

const dialect = new PgDialect();
const queryDb = drizzle.mock();
const workerSecret = "test-download-worker-secret-that-is-long-enough";
const transfer = {
  id: "00000000-0000-4000-8000-000000000001",
  objectKey: "uploads/private-object",
  originalName: "secret.txt",
  contentType: "text/plain",
  size: 42,
  uploadedAt: new Date() as Date | null,
  expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  revokedAt: null as Date | null,
  deletedAt: null as Date | null,
  downloadCount: 1,
};
let sessions: Session[];
let lock = Promise.resolve();

function stubModule(path: string, exports: unknown) {
  const id = require.resolve(path);
  const module = new Module(id);
  module.exports = exports;
  module.loaded = true;
  require.cache[id] = module;
}

stubModule("../config/env", { env: { DOWNLOAD_WORKER_SECRET: workerSecret } });

function makeTx() {
  return {
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: (condition: SQL) => ({
          returning: async () => {
            assert.equal(table, downloadSessions);
            const query = queryDb.update(downloadSessions).set(values as never).where(condition).toSQL();
            const normalized = query.sql.replace(/\s+/g, " ");
            assert.ok(normalized.includes('"download_sessions"."bootstrap_token_hash" ='));
            assert.ok(normalized.includes('"download_sessions"."claimed_at" is null'));
            assert.ok(normalized.includes('"download_sessions"."expires_at" > clock_timestamp()'));
            assert.ok(normalized.includes('"transfers"."revoked_at" is null'));
            assert.ok(normalized.includes('"transfers"."deleted_at" is null'));
            const session = sessions.find(item => query.params.includes(item.bootstrapTokenHash));
            if (!session || session.claimedAt || session.expiresAt.getTime() <= Date.now() ||
                !transfer.uploadedAt || transfer.expiresAt.getTime() <= Date.now() || transfer.revokedAt || transfer.deletedAt) {
              return [];
            }
            session.claimedAt = new Date();
            session.sessionTokenHash = values.sessionTokenHash as string;
            return [{ transferId: transfer.id, expiresAt: session.expiresAt }];
          },
        }),
      }),
    }),
    select: () => {
      let source: unknown;
      let joined = false;
      const builder = {
        from(table: unknown) {
          source = table;
          return builder;
        },
        innerJoin() {
          joined = true;
          return builder;
        },
        where(condition: SQL) {
          return {
            limit: async () => {
              const query = source === transfers
                ? queryDb.select({ id: transfers.id, objectKey: transfers.objectKey }).from(transfers)
                : queryDb.select({ id: downloadSessions.id, sessionTokenHash: downloadSessions.sessionTokenHash })
                  .from(downloadSessions);
              const joinedQuery = joined
                ? query.innerJoin(transfers, eq(transfers.id, downloadSessions.transferId))
                : query;
              const sqlQuery = joinedQuery.where(condition).limit(1).toSQL();
              if (source === transfers) {
                assert.ok(sqlQuery.params.includes(transfer.id));
                if (!transfer.uploadedAt || transfer.revokedAt || transfer.deletedAt || transfer.expiresAt <= new Date()) return [];
                return [{ objectKey: transfer.objectKey, filename: transfer.originalName,
                  contentType: transfer.contentType, size: transfer.size }];
              }
              assert.equal(source, downloadSessions);
              const session = sessions.find(item => item.sessionTokenHash !== null && sqlQuery.params.includes(item.sessionTokenHash));
              if (!session || !session.claimedAt || session.expiresAt <= new Date() || !transfer.uploadedAt ||
                  transfer.revokedAt || transfer.deletedAt || transfer.expiresAt <= new Date()) return [];
              return [{ objectKey: transfer.objectKey, filename: transfer.originalName,
                contentType: transfer.contentType, size: transfer.size, expiresAt: session.expiresAt }];
            },
          };
        },
      };
      return builder;
    },
  };
}

stubModule("../db", { db: {
  transaction: async (callback: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) => {
    const previous = lock;
    let release!: () => void;
    lock = new Promise(resolve => { release = resolve; });
    await previous;
    try {
      return await callback(makeTx());
    } finally {
      release();
    }
  },
  select: () => makeTx().select(),
} });

const { downloadSessionRoutes } = require("./download-sessions") as typeof import("./download-sessions");
const app = Fastify({ logger: false });
app.register(downloadSessionRoutes);
after(() => app.close());

function workerRequest(path: string, token: string, secret = workerSecret) {
  return app.inject({
    method: "POST",
    url: path,
    headers: { authorization: `Bearer ${secret}` },
    payload: { token },
  });
}

function seedSession(expiresAt = new Date(Date.now() + 60 * 1000)) {
  const bootstrap = createDownloadToken();
  const session: Session = {
    bootstrapTokenHash: bootstrap.tokenHash,
    sessionTokenHash: null,
    claimedAt: null,
    expiresAt,
  };
  sessions.push(session);
  return { bootstrap, session };
}

beforeEach(() => {
  sessions = [];
  lock = Promise.resolve();
  transfer.uploadedAt = new Date();
  transfer.expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  transfer.revokedAt = null;
  transfer.deletedAt = null;
  transfer.downloadCount = 1;
});

test("claim returns object metadata and a new token once while persisting only hashes", async () => {
  const { bootstrap, session } = seedSession();
  const response = await workerRequest("/internal/download-sessions/claim", bootstrap.token);
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["cache-control"], "no-store");
  const body = response.json();
  assert.equal(body.objectKey, transfer.objectKey);
  assert.equal(body.filename, transfer.originalName);
  assert.notEqual(body.sessionToken, bootstrap.token);
  assert.equal(session.sessionTokenHash, hashDownloadToken(body.sessionToken));
  assert.ok(!JSON.stringify(sessions).includes(bootstrap.token));
  assert.ok(!JSON.stringify(sessions).includes(body.sessionToken));
  assert.ok(!JSON.stringify(body).includes("ownerTokenHash"));
});

test("a claimed bootstrap credential cannot start another session", async () => {
  const { bootstrap } = seedSession();
  assert.equal((await workerRequest("/internal/download-sessions/claim", bootstrap.token)).statusCode, 200);
  const replay = await workerRequest("/internal/download-sessions/claim", bootstrap.token);
  assert.equal(replay.statusCode, 404);
  assert.deepEqual(replay.json(), { error: "Download session unavailable" });
});

test("concurrent bootstrap claims have exactly one winner", async () => {
  const { bootstrap } = seedSession();
  const responses = await Promise.all([
    workerRequest("/internal/download-sessions/claim", bootstrap.token),
    workerRequest("/internal/download-sessions/claim", bootstrap.token),
  ]);
  assert.deepEqual(responses.map(response => response.statusCode).sort(), [200, 404]);
});

test("expired bootstrap credentials are rejected without disclosing token existence", async () => {
  const { bootstrap } = seedSession(new Date(Date.now() - 1));
  const response = await workerRequest("/internal/download-sessions/claim", bootstrap.token);
  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), { error: "Download session unavailable" });
});

test("invalid bearer secrets are rejected without echoing secrets or tokens", async () => {
  const { bootstrap } = seedSession();
  const response = await workerRequest("/internal/download-sessions/claim", bootstrap.token, "wrong-secret");
  assert.equal(response.statusCode, 401);
  assert.ok(!response.body.includes(bootstrap.token));
  assert.ok(!response.body.includes("wrong-secret"));
});

test("expired, revoked, deleted, and pending transfers cannot be claimed", async () => {
  const cases = [
    () => { transfer.expiresAt = new Date(Date.now() - 1); },
    () => { transfer.revokedAt = new Date(); },
    () => { transfer.deletedAt = new Date(); },
    () => { transfer.uploadedAt = null; },
  ];
  for (const change of cases) {
    transfer.expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    transfer.revokedAt = null;
    transfer.deletedAt = null;
    transfer.uploadedAt = new Date();
    sessions = [];
    const { bootstrap } = seedSession();
    change();
    const response = await workerRequest("/internal/download-sessions/claim", bootstrap.token);
    assert.equal(response.statusCode, 404);
  }
});

test("active sessions validate repeatedly without increasing the reserved download count", async () => {
  const { bootstrap } = seedSession();
  const claimed = await workerRequest("/internal/download-sessions/claim", bootstrap.token);
  const { sessionToken } = claimed.json();
  const first = await workerRequest("/internal/download-sessions/validate", sessionToken);
  const second = await workerRequest("/internal/download-sessions/validate", sessionToken);
  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal(first.json().objectKey, transfer.objectKey);
  assert.equal(transfer.downloadCount, 1);
});

test("unclaimed, invalid, expired, revoked, and expired-parent sessions fail validation", async () => {
  const { bootstrap, session } = seedSession();
  const claim = await workerRequest("/internal/download-sessions/claim", bootstrap.token);
  const sessionToken = claim.json().sessionToken as string;

  assert.equal((await workerRequest("/internal/download-sessions/validate", createDownloadToken().token)).statusCode, 404);
  session.expiresAt = new Date(Date.now() - 1);
  assert.equal((await workerRequest("/internal/download-sessions/validate", sessionToken)).statusCode, 404);
  session.expiresAt = new Date(Date.now() + 60 * 1000);
  transfer.revokedAt = new Date();
  assert.equal((await workerRequest("/internal/download-sessions/validate", sessionToken)).statusCode, 404);
  transfer.revokedAt = null;
  transfer.expiresAt = new Date(Date.now() - 1);
  assert.equal((await workerRequest("/internal/download-sessions/validate", sessionToken)).statusCode, 404);
});
