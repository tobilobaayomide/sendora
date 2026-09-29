ALTER TABLE "transfers" ADD COLUMN "owner_token_hash" text;--> statement-breakpoint
-- Legacy transfers have no recoverable owner token. Preserve them with a hash
-- of a fresh random value that is discarded, rather than a shared credential.
UPDATE "transfers"
SET "owner_token_hash" = encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex')
WHERE "owner_token_hash" IS NULL;--> statement-breakpoint
ALTER TABLE "transfers" ALTER COLUMN "owner_token_hash" SET NOT NULL;
