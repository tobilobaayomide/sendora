import { HeadObjectCommand, S3ServiceException } from "@aws-sdk/client-s3";
import { and, eq, getTableColumns, gt, isNotNull, isNull, lt, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { env } from "../config/env";
import { db } from "../db";
import { downloadSessions, transfers } from "../db/schema";
import { createDownloadToken } from "../lib/download-token";
import { verifyOwnerToken } from "../lib/owner-token";
import { r2 } from "../lib/r2";
import { transferUnavailableReason, type TransferUnavailableReason } from "../lib/transfer-unavailable";

// Use the database clock for both public reads and failed atomic admissions.
const observedAt = sql<number>`extract(epoch from clock_timestamp()) * 1000`.mapWith(Number);
const terminalFields = {
  uploadedAt: transfers.uploadedAt,
  expiresAt: transfers.expiresAt,
  revokedAt: transfers.revokedAt,
  exhaustedAt: transfers.exhaustedAt,
  downloadCount: transfers.downloadCount,
  maxDownloads: transfers.maxDownloads,
  observedAt,
};

const transferParamsSchema = z.object({
  slug: z.string().min(1),
});

const revokeBodySchema = z.object({
  ownerToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});

class DownloadUnavailableError extends Error {
  constructor(
    readonly statusCode: 404 | 409 | 410,
    message: string,
    readonly reason?: TransferUnavailableReason,
  ) {
    super(message);
  }
}

export const DOWNLOAD_SESSION_LIFETIME_MS = 15 * 60 * 1000;

export async function transferRoutes(app: FastifyInstance) {
  app.post("/transfers/:slug/revoke", async (request, reply) => {
    const params = transferParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: "Invalid transfer slug" });
    }

    const body = revokeBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(403).send({ error: "Not authorized to revoke transfer" });
    }

    try {
      const [transfer] = await db
        .select({ id: transfers.id, ownerTokenHash: transfers.ownerTokenHash, revokedAt: transfers.revokedAt })
        .from(transfers)
        .where(eq(transfers.slug, params.data.slug))
        .limit(1);

      const authorized = verifyOwnerToken(body.data.ownerToken, transfer?.ownerTokenHash);
      if (!authorized || !transfer) {
        return reply.status(403).send({ error: "Not authorized to revoke transfer" });
      }

      if (transfer.revokedAt === null) {
        const [updated] = await db
          .update(transfers)
          // Preserve the first revocation timestamp if requests arrive concurrently.
          .set({ revokedAt: sql`coalesce(${transfers.revokedAt}, clock_timestamp())` })
          .where(eq(transfers.id, transfer.id))
          .returning({ id: transfers.id });

        if (!updated) {
          return reply.status(403).send({ error: "Not authorized to revoke transfer" });
        }
      }

      return { status: "revoked", slug: params.data.slug };
    } catch {
      return reply.status(500).send({ error: "Unable to revoke transfer" });
    }
  });

  app.post("/transfers/:slug/download", async (request, reply) => {
    const result = transferParamsSchema.safeParse(request.params);

    if (!result.success) {
      return reply.status(400).send({ error: "Invalid transfer slug" });
    }

    try {
      const download = await db.transaction(async (tx) => {
        const [transfer] = await tx
          .update(transfers)
          .set({
            downloadCount: sql`${transfers.downloadCount} + 1`,
            exhaustedAt: sql`coalesce(${transfers.exhaustedAt}, case
              when ${transfers.downloadCount} + 1 >= ${transfers.maxDownloads}
              then clock_timestamp() end)`,
          })
          .where(and(
            eq(transfers.slug, result.data.slug),
            isNotNull(transfers.uploadedAt),
            isNull(transfers.revokedAt),
            gt(transfers.expiresAt, sql`clock_timestamp()`),
            lt(transfers.downloadCount, transfers.maxDownloads),
          ))
          .returning({
            id: transfers.id,
            expiresAt: transfers.expiresAt,
          });

        if (!transfer) {
          const [current] = await tx
            .select(terminalFields)
            .from(transfers)
            .where(eq(transfers.slug, result.data.slug))
            .limit(1);

          if (!current) {
            throw new DownloadUnavailableError(404, "Transfer not found");
          }
          if (current.uploadedAt === null) {
            throw new DownloadUnavailableError(409, "Transfer is still pending");
          }
          throw new DownloadUnavailableError(410, "transfer_unavailable",
            transferUnavailableReason(current, current.observedAt));
        }

        const bootstrap = createDownloadToken();
        await tx.insert(downloadSessions).values({
          transferId: transfer.id,
          bootstrapTokenHash: bootstrap.tokenHash,
          expiresAt: sql`least(${sql`${transfer.expiresAt.toISOString()}::timestamptz`}, clock_timestamp() + ${DOWNLOAD_SESSION_LIFETIME_MS} * interval '1 millisecond')`,
        });

        const workerBaseUrl = env.DOWNLOAD_WORKER_URL.replace(/\/+$/, "");
        return { downloadUrl: `${workerBaseUrl}/download/${bootstrap.token}` };
      });
      reply.header("Cache-Control", "no-store");
      reply.header("Referrer-Policy", "no-referrer");
      return download;
      } catch (error) {
      if (error instanceof DownloadUnavailableError) {
        return reply.status(error.statusCode).send({
          error: error.message,
          ...(error.reason ? { reason: error.reason } : {}),
        });
      }

      request.log.error({ err: error }, "Failed to prepare download");

      return reply.status(500).send({ error: "Unable to prepare download" });
    }
  });

  app.get("/transfers/:slug", async (request, reply) => {
    const result = transferParamsSchema.safeParse(request.params);

    if (!result.success) {
      return reply.status(400).send({ error: "Invalid transfer slug" });
    }

    const [transfer] = await db
      .select({ ...getTableColumns(transfers), observedAt })
      .from(transfers)
      .where(eq(transfers.slug, result.data.slug))
      .limit(1);

    if (!transfer) {
      return reply.status(404).send({ error: "Transfer not found" });
    }

    if (transfer.uploadedAt === null) {
      return reply.status(409).send({ error: "Transfer is still pending" });
    }

    const reason = transferUnavailableReason(transfer, transfer.observedAt);
    if (reason) {
      return reply.status(410).send({ error: "transfer_unavailable", reason });
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
