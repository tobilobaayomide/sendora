import { randomBytes, randomUUID } from "node:crypto";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DrizzleQueryError } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { env } from "../config/env";
import { db } from "../db";
import { transfers } from "../db/schema";
import { createOwnerToken } from "../lib/owner-token";
import { r2 } from "../lib/r2";

const presignBodySchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  size: z.number().int().positive(),
  expiresInHours: z.number().int().min(1).max(168),
  maxDownloads: z.number().int().min(1).max(100),
});

const maxSlugAttempts = 3;
const slugAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function generateTransferSlug() {
  let slug = "";
  while (slug.length < 12) {
    for (const byte of randomBytes(12 - slug.length)) {
      // 248 is the largest multiple of 62 below 256; reject the rest to avoid modulo bias.
      if (byte < 248) slug += slugAlphabet[byte % slugAlphabet.length];
    }
  }
  return slug;
}

function isSlugCollision(error: unknown) {
  const cause = error instanceof DrizzleQueryError ? error.cause : error;
  return cause !== null && typeof cause === "object"
    && "code" in cause && cause.code === "23505"
    && "constraint_name" in cause && cause.constraint_name === "transfers_slug_unique";
}

export async function uploadRoutes(app: FastifyInstance) {
  app.post("/uploads/presign", async (request, reply) => {
    const result = presignBodySchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        error: "Invalid request body",
        issues: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const { filename, contentType, size, expiresInHours, maxDownloads } = result.data;

    const objectKey = `uploads/${randomUUID()}`;
    const { ownerToken, ownerTokenHash } = createOwnerToken();
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const command = new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: objectKey,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(r2, command, {
      expiresIn: 300,
    });

    let slug = "";
    for (let attempt = 0; attempt < maxSlugAttempts; attempt++) {
      slug = generateTransferSlug();
      try {
        await db.insert(transfers).values({
          slug,
          ownerTokenHash,
          objectKey,
          originalName: filename,
          contentType,
          size,
          expiresAt,
          maxDownloads,
        });
        break;
      } catch (error) {
        if (!isSlugCollision(error) || attempt === maxSlugAttempts - 1) {
          // Drizzle errors may contain SQL parameters, including the owner token hash.
          return reply.status(500).send({ error: "Unable to create transfer" });
        }
      }
    }

    reply.header("Cache-Control", "no-store");
    return {
      uploadUrl,
      slug,
      ownerToken,
    };
  });
}
