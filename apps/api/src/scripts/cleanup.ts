import "dotenv/config";

import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { and, asc, eq, isNull, lte, sql } from "drizzle-orm";

import { env } from "../config/env";
import { db } from "../db";
import { transfers } from "../db/schema";
import { r2 } from "../lib/r2";

export async function cleanupTransfers() {
  // PostgreSQL LEAST ignores NULLs; expiresAt is always present.
  const terminalAt = sql`least(${transfers.expiresAt}, ${transfers.revokedAt}, ${transfers.exhaustedAt})`;
  const candidates = await db
    .select({ id: transfers.id, objectKey: transfers.objectKey })
    .from(transfers)
    .where(and(
      isNull(transfers.deletedAt),
      lte(terminalAt, sql`now() - interval '1 hour'`),
    ))
    .orderBy(asc(terminalAt), asc(transfers.id))
    .limit(100);

  let deleted = 0;
  let failed = 0;

  for (const transfer of candidates) {
    try {
      // Deleting an already-missing object is safe, including after a DB write failure.
      await r2.send(new DeleteObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: transfer.objectKey,
      }));

      await db
        .update(transfers)
        .set({ deletedAt: sql`clock_timestamp()` })
        .where(and(eq(transfers.id, transfer.id), isNull(transfers.deletedAt)));
      deleted++;
    } catch {
      // Leave deletedAt unset so the next manual run can retry this transfer.
      failed++;
    }
  }

  return { selected: candidates.length, deleted, failed };
}

async function main() {
  try {
    const result = await cleanupTransfers();
    console.log("Cleanup finished:", result);
    if (result.failed > 0) process.exitCode = 1;
  } finally {
    r2.destroy();
    await db.$client.end({ timeout: 5 });
  }
}

if (require.main === module) {
  main().catch(() => {
    console.error("Cleanup failed. Check database and R2 configuration.");
    process.exitCode = 1;
  });
}
