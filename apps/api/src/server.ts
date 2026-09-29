import "dotenv/config";
import cors from "@fastify/cors";
import Fastify from "fastify";

import { db } from "./db";
import { startCleanupScheduler } from "./lib/cleanup-scheduler";
import { r2 } from "./lib/r2";
import { uploadRoutes } from "./routes/uploads";
import { transferRoutes } from "./routes/transfers";

const app = Fastify({
  logger: true,
});

let stopCleanup: (() => Promise<void>) | undefined;
let shuttingDown = false;

app.addHook("preClose", async () => {
  await stopCleanup?.();
});

app.addHook("onClose", async () => {
  r2.destroy();
  await db.$client.end({ timeout: 5 });
});

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  void app.close().catch(() => {
    app.log.error("API shutdown failed");
    process.exitCode = 1;
  });
}

app.get("/health", async () => {
  return {
    status: "ok",
  };
});

const start = async () => {
  try {
     await app.register(cors, {
      origin: "http://localhost:3000",
    });

    await app.register(uploadRoutes);
    await app.register(transferRoutes);

    await app.listen({
      port: 4000,
      host: "0.0.0.0",
    });

    stopCleanup = startCleanupScheduler(app.log);
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
