import { HeadObjectCommand, S3ServiceException } from "@aws-sdk/client-s3";
import { and, eq, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { env } from "../config/env";
import { db } from "../db";
import { transfers } from "../db/schema";
import { r2 } from "../lib/r2";

const completeParamsSchema = z.object({
  slug: z.string().min(1),
});

export async function transferRoutes(app: FastifyInstance) {
  app.post("/transfers/:slug/complete", async (request, reply) => {
    const result = completeParamsSchema.safeParse(request.params);

    if (!result.success) {
      return reply.status(400).send({ error: "Invalid transfer slug" });
    }

    const { slug } = result.data;
    const [transfer] = await db
      .select()
      .from(transfers)
      .where(eq(transfers.slug, slug))
      .limit(1);

    if (!transfer) {
      return reply.status(404).send({ error: "Transfer not found" });
    }

    if (transfer.uploadedAt !== null) {
      return { status: "ready", slug };
    }

    let object;
    try {
      object = await r2.send(new HeadObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: transfer.objectKey,
      }));
    } catch (error) {
      if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404) {
        return reply.status(409).send({ error: "Uploaded object not found" });
      }

      return reply.status(502).send({ error: "Unable to verify uploaded object" });
    }

    if (object.ContentLength === undefined || object.ContentLength !== transfer.size) {
      return reply.status(409).send({ error: "Uploaded object size does not match expected size" });
    }

    const [updated] = await db
      .update(transfers)
      .set({ uploadedAt: new Date() })
      .where(and(eq(transfers.id, transfer.id), isNull(transfers.uploadedAt)))
      .returning({ id: transfers.id });

    if (!updated) {
      const [current] = await db
        .select({ uploadedAt: transfers.uploadedAt })
        .from(transfers)
        .where(eq(transfers.id, transfer.id))
        .limit(1);

      if (!current) {
        return reply.status(404).send({ error: "Transfer not found" });
      }

      if (current.uploadedAt === null) {
        return reply.status(409).send({ error: "Transfer is still pending" });
      }
    }

    return { status: "ready", slug };
  });
}
