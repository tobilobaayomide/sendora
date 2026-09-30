DROP INDEX "download_sessions_session_token_hash_idx";--> statement-breakpoint
ALTER TABLE "download_sessions" DROP COLUMN "session_token_hash";