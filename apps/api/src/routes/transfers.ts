import { GetObjectCommand, HeadObjectCommand, S3ServiceException } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { and, eq, gt, isNotNull, isNull, lt, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { env } from "../config/env";
import { db } from "../db";
import { transfers } from "../db/schema";
import { attachmentDisposition } from "../lib/content-disposition";
import { r2 } from "../lib/r2";

const transferParamsSchema = z.object({
  slug: z.string().min(1),
});

class DownloadUnavailableError extends Error {
  constructor(readonly statusCode: 404 | 409 | 410, message: string) {
    super(message);
  }
}

export async function transferRoutes(app: FastifyInstance) {
  app.post("/transfers/:slug/download", async (request, reply) => {
    const result = transferParamsSchema.safeParse(request.params);

    if (!result.success) {
      return reply.status(400).send({ error: "Invalid transfer slug" });
    }

    try {
      return await db.transaction(async (tx) => {
        const [transfer] = await tx
          .update(transfers)
          .set({ downloadCount: sql`${transfers.downloadCount} + 1` })
          .where(and(
            eq(transfers.slug, result.data.slug),
            isNotNull(transfers.uploadedAt),
            isNull(transfers.revokedAt),
            gt(transfers.expiresAt, sql`clock_timestamp()`),
            lt(transfers.downloadCount, transfers.maxDownloads),
          ))
          .returning({
            objectKey: transfers.objectKey,
            expiresAt: transfers.expiresAt,
            originalName: transfers.originalName,
          });

        if (!transfer) {
          const [current] = await tx
            .select({ uploadedAt: transfers.uploadedAt })
            .from(transfers)
            .where(eq(transfers.slug, result.data.slug))
            .limit(1);

          if (!current) {
            throw new DownloadUnavailableError(404, "Transfer not found");
          }
          if (current.uploadedAt === null) {
            throw new DownloadUnavailableError(409, "Transfer is still pending");
          }
          throw new DownloadUnavailableError(410, "Transfer is no longer available");
        }

        // Pin signing time so SDK work cannot extend the URL beyond transfer expiry.
        const signingDate = new Date();
        const expiresIn = Math.min(
          300,
          Math.floor((transfer.expiresAt.getTime() - signingDate.getTime()) / 1000),
        );

        if (expiresIn < 1) {
          throw new DownloadUnavailableError(410, "Transfer is no longer available");
        }

        const downloadUrl = await getSignedUrl(r2, new GetObjectCommand({
          Bucket: env.R2_BUCKET_NAME,
          Key: transfer.objectKey,
          ResponseContentDisposition: attachmentDisposition(transfer.originalName),
        }), { expiresIn, signingDate });

        // SigV4 timestamps have whole-second precision. Roll back if signing took too long.
        const urlExpiresAt = Math.floor(signingDate.getTime() / 1000) * 1000 + expiresIn * 1000;
        if (Date.now() >= urlExpiresAt) {
          throw new DownloadUnavailableError(410, "Transfer is no longer available");
        }

        return { downloadUrl, expiresIn };
      });
    } catch (error) {
      if (error instanceof DownloadUnavailableError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      return reply.status(500).send({ error: "Unable to prepare download" });
    }
  });

  app.get("/transfers/:slug", async (request, reply) => {
    const result = transferParamsSchema.safeParse(request.params);

    if (!result.success) {
      return reply.status(400).send({ error: "Invalid transfer slug" });
    }

    const [transfer] = await db
      .select()
      .from(transfers)
      .where(eq(transfers.slug, result.data.slug))
      .limit(1);

    if (!transfer) {
      return reply.status(404).send({ error: "Transfer not found" });
    }

    if (transfer.uploadedAt === null) {
      return reply.status(409).send({ error: "Transfer is still pending" });
    }

    if (
      transfer.expiresAt.getTime() <= Date.now() ||
      transfer.revokedAt !== null ||
      transfer.downloadCount >= transfer.maxDownloads
    ) {
      return reply.status(410).send({ error: "Transfer is no longer available" });
    }

    return {
      slug: transfer.slug,
      filename: transfer.originalName,
      contentType: transfer.contentType,
      size: transfer.size,
      expiresAt: transfer.expiresAt.toISOString(),
      maxDownloads: transfer.maxDownloads,
      downloadCount: transfer.downloadCount,
    };
  });

  app.post("/transfers/:slug/complete", async (request, reply) => {
    const result = transferParamsSchema.safeParse(request.params);

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
