import assert from "node:assert/strict";
import Module from "node:module";
import { afterEach, beforeEach, mock, test } from "node:test";
import Fastify from "fastify";

type Result = { selected: number; deleted: number; failed: number; sessionsDeleted: number };
const empty: Result = { selected: 0, deleted: 0, failed: 0, sessionsDeleted: 0 };
let cleanup: () => Promise<Result>;
let calls: number;
let tick: () => void;
let intervalMs: number | undefined;
let unreferenced: boolean;
let cleared: boolean;
let entries: { level: string; args: unknown[] }[];
let finishRun: ((value: Result) => void) | undefined;
let stop: (() => Promise<void>) | undefined;

const id = require.resolve("../scripts/cleanup");
const cleanupModule = new Module(id);
cleanupModule.exports = { cleanupTransfers: () => { calls++; return cleanup(); } };
cleanupModule.loaded = true;
require.cache[id] = cleanupModule;
const { startCleanupScheduler } = require("./cleanup-scheduler") as typeof import("./cleanup-scheduler");

const log = {
  info: (...args: unknown[]) => { entries.push({ level: "info", args }); },
  warn: (...args: unknown[]) => { entries.push({ level: "warn", args }); },
  error: (...args: unknown[]) => { entries.push({ level: "error", args }); },
};
const flush = () => new Promise<void>(resolve => setImmediate(resolve));

beforeEach(() => {
  calls = 0; entries = []; intervalMs = undefined; unreferenced = false; cleared = false;
  finishRun = undefined; stop = undefined;
  cleanup = async () => empty;
  const timer = { unref: () => { unreferenced = true; } } as unknown as NodeJS.Timeout;
  mock.method(globalThis, "setInterval", (callback: () => void, milliseconds?: number) => {
    tick = callback;
    intervalMs = milliseconds;
    return timer;
  });
  mock.method(globalThis, "clearInterval", (handle: unknown) => {
    assert.equal(handle, timer);
    cleared = true;
  });
});

afterEach(async () => {
  finishRun?.(empty);
  await stop?.();
  mock.restoreAll();
});

test("invokes shared cleanup every five minutes, without running immediately", async () => {
  stop = startCleanupScheduler(log);
  assert.equal(intervalMs, 300000);
  assert.equal(unreferenced, true);
  assert.equal(calls, 0);
  tick(); await flush();
  assert.equal(calls, 1);
  tick(); await flush();
  assert.equal(calls, 2);
  assert.deepEqual(entries.map(entry => entry.level), ["info", "info"]);
});

test("skips overlapping intervals and resumes after completion", async () => {
  cleanup = () => new Promise(resolve => { finishRun = resolve; });
  stop = startCleanupScheduler(log);
  tick(); tick(); await flush();
  assert.equal(calls, 1);
  tick(); await flush();
  assert.equal(calls, 1);
  finishRun!(empty); await flush();
  cleanup = async () => empty;
  tick(); await flush();
  assert.equal(calls, 2);
});

test("async failure is logged safely and the next interval retries", async () => {
  cleanup = async () => { throw new Error("sensitive upstream details"); };
  stop = startCleanupScheduler(log);
  tick(); await flush();
  assert.equal(calls, 1);
  assert.equal(entries[0].level, "error");
  assert.ok(!JSON.stringify(entries).includes("sensitive"));
  cleanup = async () => empty;
  tick(); await flush();
  assert.equal(calls, 2);
  assert.equal(entries[1].level, "info");
});

test("synchronous failure also releases overlap protection", async () => {
  cleanup = () => { throw new Error("sensitive database details"); };
  stop = startCleanupScheduler(log);
  tick(); await flush();
  cleanup = async () => empty;
  tick(); await flush();
  assert.equal(calls, 2);
  assert.deepEqual(entries.map(entry => entry.level), ["error", "info"]);
  assert.ok(!JSON.stringify(entries).includes("sensitive"));
});

test("partial batch failures log counts and remain retryable", async () => {
  cleanup = async () => ({ selected: 3, deleted: 2, failed: 1, sessionsDeleted: 4 });
  stop = startCleanupScheduler(log);
  tick(); await flush();
  assert.equal(entries[0].level, "warn");
  assert.deepEqual(entries[0].args[0], { selected: 3, deleted: 2, failed: 1, sessionsDeleted: 4 });
  cleanup = async () => ({ selected: 1, deleted: 1, failed: 0, sessionsDeleted: 0 });
  tick(); await flush();
  assert.equal(calls, 2);
  assert.equal(entries[1].level, "info");
});

test("stop clears the interval, waits for the active run, and prevents new runs", async () => {
  cleanup = () => new Promise(resolve => { finishRun = resolve; });
  stop = startCleanupScheduler(log);
  tick(); await flush();
  let stopped = false;
  const stopping = stop().then(() => { stopped = true; });
  assert.equal(cleared, true);
  await flush();
  assert.equal(stopped, false);
  tick(); await flush();
  assert.equal(calls, 1);
  finishRun!(empty);
  await stopping;
  assert.equal(stopped, true);
  tick(); await flush();
  assert.equal(calls, 1);
});

test("Fastify shutdown drains cleanup before closing shared resources", async () => {
  cleanup = () => new Promise(resolve => { finishRun = resolve; });
  stop = startCleanupScheduler(log);
  tick(); await flush();
  let resourcesClosed = false;
  const app = Fastify({ logger: false });
  app.addHook("preClose", async () => { await stop!(); });
  app.addHook("onClose", async () => { resourcesClosed = true; });
  await app.ready();
  const closing = app.close();
  await flush();
  assert.equal(cleared, true);
  assert.equal(resourcesClosed, false);
  finishRun!(empty);
  await closing;
  assert.equal(resourcesClosed, true);
});
