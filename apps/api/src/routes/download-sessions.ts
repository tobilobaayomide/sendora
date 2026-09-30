import { createHash, timingSafeEqual } from "node:crypto";

import { and, eq, gt, isNotNull, isNull, sql } from "drizzle-orm";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

import { env } from "../config/env";
import { db } from "../db";
import { downloadSessions, transfers } from "../db/schema";
import { createDownloadToken, hashDownloadToken } from "../lib/download-token";

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const tokenBodySchema = z.object({ token: tokenSchema });

function constantTimeSecretMatch(candidate: string | undefined, expected: string) {
  const candidateHash = createHash("sha256").update(candidate ?? "", "utf8").digest();
  const expectedHash = createHash("sha256").update(expected, "utf8").digest();
  const matches = timingSafeEqual(candidateHash, expectedHash);
  return matches && candidate !== undefined && candidate.length === expected.length;
}

function isWorkerRequest(authorization: string | undefined) {
  const match = authorization?.match(/^Bearer (.+)$/);
  return constantTimeSecretMatch(match?.[1], env.DOWNLOAD_WORKER_SECRET);
}

function unavailable(reply: FastifyReply) {
  return reply.status(404).send({ error: "Download session unavailable" });
}

export async function downloadSessionRoutes(app: FastifyInstance) {
  app.post("/internal/download-sessions/claim", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    reply.header("Referrer-Policy", "no-referrer");
    if (!isWorkerRequest(request.headers.authorization)) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const parsed = tokenBodySchema.safeParse(request.body);
    if (!parsed.success) return unavailable(reply);

    const { token } = parsed.data;
    const sessionToken = createDownloadToken();

    try {
      return await db.transaction(async (tx) => {
        const [claimed] = await tx
          .update(downloadSessions)
          .set({
            claimedAt: sql`clock_timestamp()`,
            sessionTokenHash: sessionToken.tokenHash,
          })
          .where(and(
            eq(downloadSessions.bootstrapTokenHash, hashDownloadToken(token)),
            isNull(downloadSessions.claimedAt),
            gt(downloadSessions.expiresAt, sql`clock_timestamp()`),
            sql`exists (
              select 1 from ${transfers}
              where ${transfers.id} = ${downloadSessions.transferId}
                and ${transfers.uploadedAt} is not null
                and ${transfers.revokedAt} is null
                and ${transfers.deletedAt} is null
                and ${transfers.expiresAt} > clock_timestamp()
            )`,
          ))
          .returning({ transferId: downloadSessions.transferId, expiresAt: downloadSessions.expiresAt });

        if (!claimed) return unavailable(reply);

        const [transfer] = await tx
          .select({
            objectKey: transfers.objectKey,
            filename: transfers.originalName,
            contentType: transfers.contentType,
            size: transfers.size,
          })
          .from(transfers)
          .where(and(
            eq(transfers.id, claimed.transferId),
            isNotNull(transfers.uploadedAt),
            isNull(transfers.revokedAt),
            isNull(transfers.deletedAt),
            gt(transfers.expiresAt, sql`clock_timestamp()`),
          ))
          .limit(1);

        if (!transfer) throw new Error("Download transfer is unavailable");

        return {
          ...transfer,
          sessionToken: sessionToken.token,
          expiresAt: claimed.expiresAt.toISOString(),
        };
      });
    } catch {
      return unavailable(reply);
    }
  });

  app.post("/internal/download-sessions/validate", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    reply.header("Referrer-Policy", "no-referrer");
    if (!isWorkerRequest(request.headers.authorization)) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const parsed = tokenBodySchema.safeParse(request.body);
    if (!parsed.success) return unavailable(reply);

    try {
      const [active] = await db
        .select({
          objectKey: transfers.objectKey,
          filename: transfers.originalName,
          contentType: transfers.contentType,
          size: transfers.size,
          expiresAt: downloadSessions.expiresAt,
        })
        .from(downloadSessions)
        .innerJoin(transfers, eq(transfers.id, downloadSessions.transferId))
        .where(and(
          eq(downloadSessions.sessionTokenHash, hashDownloadToken(parsed.data.token)),
          isNotNull(downloadSessions.claimedAt),
          gt(downloadSessions.expiresAt, sql`clock_timestamp()`),
          isNotNull(transfers.uploadedAt),
          isNull(transfers.revokedAt),
          isNull(transfers.deletedAt),
          gt(transfers.expiresAt, sql`clock_timestamp()`),
        ))
        .limit(1);

      if (!active) return unavailable(reply);

      return {
        objectKey: active.objectKey,
        filename: active.filename,
        contentType: active.contentType,
        size: active.size,
        expiresAt: active.expiresAt.toISOString(),
      };
    } catch {
      return unavailable(reply);
    }
  });
}
