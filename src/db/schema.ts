import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const DEFAULT_ROOMS = ["Entrance", "Hall", "Kitchen", "Bedroom", "Bathroom", "Balcony"];

export const flatStage = pgEnum("flat_stage", ["movein", "moveout"]);
export const photoCondition = pgEnum("photo_condition", ["good", "worn", "damaged"]);
export const chargeDecision = pgEnum("charge_decision", ["already_there", "wear_and_tear", "no_receipt", "check", "likely_valid"]);
export const aiKind = pgEnum("ai_kind", ["agreement", "check", "letter"]);
export const ownerReviewStatus = pgEnum("owner_review_status", ["pending", "confirmed", "disputed"]);

export const flats = pgTable(
  "flats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // References neon_auth."user"(id). Neon Auth owns that table, so the foreign key is added in a
    // hand-written migration (drizzle/0001_auth_fk.sql) rather than declared here.
    userId: uuid("user_id").notNull(),
    stage: flatStage("stage").notNull().default("movein"),
    isExample: boolean("is_example").notNull().default(false),
    address: text("address").notNull(),
    ownerName: text("owner_name").notNull().default(""),
    tenantName: text("tenant_name").notNull().default(""),
    moveIn: date("move_in"),
    keysHandedOver: date("keys_handed_over"),
    monthlyRent: numeric("monthly_rent", { precision: 12, scale: 2 }),
    deposit: numeric("deposit", { precision: 12, scale: 2 }),
    refundDays: integer("refund_days"),
    rooms: text("rooms").array().notNull().default(sql`ARRAY['Entrance','Hall','Kitchen','Bedroom','Bathroom','Balcony']::text[]`),
    nextPhotoN: integer("next_photo_n").notNull().default(1),
    evidenceNotes: text("evidence_notes").notNull().default(""),
    deductionsText: text("deductions_text").notNull().default(""),
    letter: text("letter").notNull().default(""),
    analyzedAt: timestamp("analyzed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("flats_user_idx").on(t.userId)],
);

export const photos = pgTable(
  "photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    flatId: uuid("flat_id").notNull().references(() => flats.id, { onDelete: "cascade" }),
    // The P-number shown to the user (P1, P2, ...). Never reused within a flat.
    n: integer("n").notNull(),
    room: text("room").notNull(),
    condition: photoCondition("condition").notNull().default("good"),
    note: text("note").notNull().default(""),
    blobPathname: text("blob_pathname").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    // SHA-256 of the original file, computed in the browser before upload.
    sha256: text("sha256").notNull().default(""),
    takenAt: timestamp("taken_at", { withTimezone: true }),
    // "camera" when the time came from EXIF, "file" when it came from the file's date.
    takenFrom: text("taken_from").notNull().default("file"),
    // "live" when taken with ProofNest's own camera screen (stamped with the day code), "upload" for any other file.
    capture: text("capture").notNull().default("upload"),
    dayCode: text("day_code").notNull().default(""),
    // RFC 3161 timestamp from a public authority over the stored file's SHA-256: the signed reply, base64.
    tsaToken: text("tsa_token").notNull().default(""),
    tsaTime: timestamp("tsa_time", { withTimezone: true }),
    tsaAuthority: text("tsa_authority").notNull().default(""),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("photos_flat_n_uq").on(t.flatId, t.n), index("photos_flat_idx").on(t.flatId)],
);

export type AgreementFile = { pathname: string; name: string; contentType: string; sizeBytes: number };
export type AgreementFacts = {
  owner?: string;
  tenant?: string;
  address?: string;
  agreementDate?: string;
  start?: string;
  end?: string;
  rent?: number | null;
  deposit?: number | null;
  maintenance?: string;
  lockIn?: string;
  notice?: string;
  refundDays?: number | null;
};
export type AgreementClause = { topic: string; clause: string; quote: string; plain: string };

export const agreements = pgTable("agreements", {
  flatId: uuid("flat_id").primaryKey().references(() => flats.id, { onDelete: "cascade" }),
  files: jsonb("files").$type<AgreementFile[]>().notNull().default([]),
  facts: jsonb("facts").$type<AgreementFacts>().notNull().default({}),
  clauses: jsonb("clauses").$type<AgreementClause[]>().notNull().default([]),
  flags: jsonb("flags").$type<string[]>().notNull().default([]),
  text: text("text").notNull().default(""),
  pages: integer("pages").notNull().default(0),
  readAt: timestamp("read_at", { withTimezone: true }),
  dismissed: boolean("dismissed").notNull().default(false),
});

export const charges = pgTable(
  "charges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    flatId: uuid("flat_id").notNull().references(() => flats.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    item: text("item").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
    aiVerdict: chargeDecision("ai_verdict"),
    decision: chargeDecision("decision").notNull().default("check"),
    photoNs: integer("photo_ns").array().notNull().default(sql`'{}'::integer[]`),
    reason: text("reason").notNull().default(""),
    confidence: real("confidence"),
    // "ai" when the AI check produced it, "manual" when the tenant added it.
    source: text("source").notNull().default("ai"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("charges_flat_idx").on(t.flatId)],
);

export const aiRuns = pgTable(
  "ai_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    flatId: uuid("flat_id").notNull().references(() => flats.id, { onDelete: "cascade" }),
    kind: aiKind("kind").notNull(),
    status: text("status").notNull(),
    model: text("model").notNull().default(""),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    latencyMs: integer("latency_ms"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_runs_flat_idx").on(t.flatId)],
);

/** One photo exactly as the owner was shown it, so a confirmation always refers to a fixed record. */
export type ReviewPhoto = { id: string; n: number; room: string; condition: "good" | "worn" | "damaged"; note: string; sha256: string; takenAt: string | null; takenFrom: string };

/**
 * A link the tenant sends the owner (usually on WhatsApp) to confirm the move-in record without an account.
 * The photos are copied into `photos` when the link is made; the owner's answer is written once and never changed.
 */
export const ownerReviews = pgTable(
  "owner_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    flatId: uuid("flat_id").notNull().references(() => flats.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    photos: jsonb("photos").$type<ReviewPhoto[]>().notNull(),
    // SHA-256 of the photo list above, so the record the owner confirmed can be identified later.
    recordHash: text("record_hash").notNull(),
    status: ownerReviewStatus("status").notNull().default("pending"),
    ownerName: text("owner_name").notNull().default(""),
    ownerNote: text("owner_note").notNull().default(""),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("owner_reviews_token_uq").on(t.token), index("owner_reviews_flat_idx").on(t.flatId)],
);

/** One-time sign-in codes sent on WhatsApp. Only a keyed hash of each code is stored. */
export const phoneCodes = pgTable(
  "phone_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phone: text("phone").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    ip: text("ip").notNull().default(""),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("phone_codes_phone_idx").on(t.phone, t.createdAt)],
);

export type Flat = typeof flats.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type Agreement = typeof agreements.$inferSelect;
export type Charge = typeof charges.$inferSelect;
export type OwnerReview = typeof ownerReviews.$inferSelect;
