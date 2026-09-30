import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const transfers = pgTable(
  "transfers",
  {
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
  },
  (table) => [
    check("transfers_size_positive", sql`${table.size} > 0`),

    check(
      "transfers_max_downloads_positive",
      sql`${table.maxDownloads} > 0`,
    ),

    check(
      "transfers_download_count_nonnegative",
      sql`${table.downloadCount} >= 0`,
    ),

    check(
      "transfers_expiry_after_creation",
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
  ],
);

export const downloadSessions = pgTable(
  "download_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    transferId: uuid("transfer_id")
      .notNull()
      .references(() => transfers.id, { onDelete: "cascade" }),

    // One-time credential used only to begin the download session.
    bootstrapTokenHash: text("bootstrap_token_hash").notNull(),

    // Created when the bootstrap token is successfully claimed.
    // NULL before the session has been claimed.
    sessionTokenHash: text("session_token_hash"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    claimedAt: timestamp("claimed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("download_sessions_bootstrap_token_hash_idx").on(
      table.bootstrapTokenHash,
    ),

    uniqueIndex("download_sessions_session_token_hash_idx").on(
      table.sessionTokenHash,
    ),

    index("download_sessions_transfer_id_idx").on(table.transferId),

    check(
      "download_sessions_expiry_after_creation",
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
  ],
);