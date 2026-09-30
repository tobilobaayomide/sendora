CREATE TABLE "download_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_id" uuid NOT NULL,
	"bootstrap_token_hash" text NOT NULL,
	"session_token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"claimed_at" timestamp with time zone,
	CONSTRAINT "download_sessions_expiry_after_creation" CHECK ("download_sessions"."expires_at" > "download_sessions"."created_at")
);
--> statement-breakpoint
ALTER TABLE "download_sessions" ADD CONSTRAINT "download_sessions_transfer_id_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."transfers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "download_sessions_bootstrap_token_hash_idx" ON "download_sessions" USING btree ("bootstrap_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "download_sessions_session_token_hash_idx" ON "download_sessions" USING btree ("session_token_hash");--> statement-breakpoint
CREATE INDEX "download_sessions_transfer_id_idx" ON "download_sessions" USING btree ("transfer_id");