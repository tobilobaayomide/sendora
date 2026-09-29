CREATE TABLE "transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"object_key" text NOT NULL,
	"original_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"max_downloads" integer NOT NULL,
	"download_count" integer DEFAULT 0 NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "transfers_slug_unique" UNIQUE("slug"),
	CONSTRAINT "transfers_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "transfers_size_positive" CHECK ("transfers"."size" > 0),
	CONSTRAINT "transfers_max_downloads_positive" CHECK ("transfers"."max_downloads" > 0),
	CONSTRAINT "transfers_download_count_nonnegative" CHECK ("transfers"."download_count" >= 0),
	CONSTRAINT "transfers_expiry_after_creation" CHECK ("transfers"."expires_at" > "transfers"."created_at")
);
