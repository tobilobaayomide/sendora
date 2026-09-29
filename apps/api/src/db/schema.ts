import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const transfers = pgTable("transfers", {
  id: uuid("id").defaultRandom().primaryKey(),

  slug: text("slug").notNull().unique(),

  ownerTokenHash: text("owner_token_hash").notNull(),

  objectKey: text("object_key").notNull().unique(),

  originalName: text("original_name").notNull(),

  contentType: text("content_type").notNull(),

  size: bigint("size", { mode: "number" }).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),

  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

  uploadedAt: timestamp("uploaded_at", { withTimezone: true }),

  maxDownloads: integer("max_downloads").notNull(),

  downloadCount: integer("download_count").default(0).notNull(),

  revokedAt: timestamp("revoked_at", { withTimezone: true }),

  exhaustedAt: timestamp("exhausted_at", { withTimezone: true }),

  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  check("transfers_size_positive", sql`${table.size} > 0`),
  check("transfers_max_downloads_positive", sql`${table.maxDownloads} > 0`),
  check("transfers_download_count_nonnegative", sql`${table.downloadCount} >= 0`),
  check("transfers_expiry_after_creation", sql`${table.expiresAt} > ${table.createdAt}`),
]);
