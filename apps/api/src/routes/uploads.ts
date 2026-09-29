import { randomBytes, randomUUID } from "node:crypto";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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
    const slug = randomBytes(16).toString("base64url");
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
    } catch {
      // Drizzle errors may contain SQL parameters, including the owner token hash.
      return reply.status(500).send({ error: "Unable to create transfer" });
    }

    reply.header("Cache-Control", "no-store");
    return {
      uploadUrl,
      slug,
      ownerToken,
    };
  });
}
