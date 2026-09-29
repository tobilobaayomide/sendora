import { randomUUID } from "node:crypto";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { FastifyInstance } from "fastify";

import { r2 } from "../lib/r2";

type PresignBody = {
  filename: string;
  contentType: string;
};

export async function uploadRoutes(app: FastifyInstance) {
  app.post<{ Body: PresignBody }>("/uploads/presign", async (request, reply) => {
    const { filename, contentType } = request.body;

    if (!filename || !contentType) {
      return reply.status(400).send({
        error: "filename and contentType are required",
      });
    }

    const bucket = process.env.R2_BUCKET_NAME;

    if (!bucket) {
      throw new Error("Missing R2_BUCKET_NAME");
    }

    const key = `uploads/${randomUUID()}/${filename}`;

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