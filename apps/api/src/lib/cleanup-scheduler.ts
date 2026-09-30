import type { FastifyBaseLogger } from "fastify";

import { cleanupTransfers } from "../scripts/cleanup";

export function startCleanupScheduler(log: Pick<FastifyBaseLogger, "info" | "warn" | "error">) {
  let running: Promise<void> | undefined;
  let stopped = false;

  const interval = setInterval(() => {
    if (stopped || running) return;

    running = Promise.resolve()
      .then(() => cleanupTransfers())
      .then(({ selected, deleted, failed, sessionsDeleted }) => {
        if (failed > 0) {
          log.warn({ selected, deleted, failed, sessionsDeleted }, "Scheduled cleanup finished with failures; next run will retry");
        } else {
          log.info({ selected, deleted, failed, sessionsDeleted }, "Scheduled cleanup finished");
        }
      })
      .catch(() => {
        log.error("Scheduled cleanup failed; next run will retry");
      })
      .finally(() => {
        running = undefined;
      });
  }, 5 * 60 * 1000);

  interval.unref();

  return async function stopCleanupScheduler() {
    stopped = true;
    clearInterval(interval);
    await running;
  };
}
