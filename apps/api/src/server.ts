import "dotenv/config";
import cors from "@fastify/cors";
import Fastify from "fastify";

import { uploadRoutes } from "./routes/uploads";
import { transferRoutes } from "./routes/transfers";

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
     await app.register(cors, {
      origin: "http://localhost:3000",
    });

    await app.register(uploadRoutes);
    await app.register(transferRoutes);

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
