import { randomUUID } from "node:crypto";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { r2 } from "../lib/r2";

const presignBodySchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  size: z.number().int().positive(),
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

    const { contentType } = result.data;

    const bucket = process.env.R2_BUCKET_NAME;

    if (!bucket) {
      throw new Error("Missing R2_BUCKET_NAME");
    }

    const key = `uploads/${randomUUID()}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(r2, command, {
      expiresIn: 300,
    });

    return {
      uploadUrl,
      key,
    };
  });
}
