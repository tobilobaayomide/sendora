import "dotenv/config";
import Fastify from "fastify";

import { uploadRoutes } from "./routes/uploads";

const app = Fastify({
  logger: true,
});

app.get("/health", async () => {
  return {
    status: "ok",
  };
});

const start = async () => {
  try {
    await app.register(uploadRoutes);

    await app.listen({
      port: 4000,
      host: "0.0.0.0",
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();