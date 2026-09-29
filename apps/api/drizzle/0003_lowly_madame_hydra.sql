ALTER TABLE "transfers" ADD COLUMN "exhausted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "transfers" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
-- Historic exhaustion times were not recorded. Start a conservative grace period
-- for already-exhausted transfers; earlier expiry/revocation still takes precedence.
UPDATE "transfers"
SET "exhausted_at" = clock_timestamp()
WHERE "download_count" >= "max_downloads" AND "exhausted_at" IS NULL;
