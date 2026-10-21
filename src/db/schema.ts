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
    // "ai" when Claude produced it, "manual" when the tenant added it.
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

export type Flat = typeof flats.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type Agreement = typeof agreements.$inferSelect;
export type Charge = typeof charges.$inferSelect;
