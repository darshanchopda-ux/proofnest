CREATE TYPE "public"."ai_kind" AS ENUM('agreement', 'check', 'letter');--> statement-breakpoint
CREATE TYPE "public"."charge_decision" AS ENUM('already_there', 'wear_and_tear', 'no_receipt', 'check', 'likely_valid');--> statement-breakpoint
CREATE TYPE "public"."flat_stage" AS ENUM('movein', 'moveout');--> statement-breakpoint
CREATE TYPE "public"."photo_condition" AS ENUM('good', 'worn', 'damaged');--> statement-breakpoint
CREATE TABLE "agreements" (
	"flat_id" uuid PRIMARY KEY NOT NULL,
	"files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"facts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"clauses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"pages" integer DEFAULT 0 NOT NULL,
	"read_at" timestamp with time zone,
	"dismissed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flat_id" uuid NOT NULL,
	"kind" "ai_kind" NOT NULL,
	"status" text NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"latency_ms" integer,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flat_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"item" text NOT NULL,
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"ai_verdict" charge_decision,
	"decision" charge_decision DEFAULT 'check' NOT NULL,
	"photo_ns" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"confidence" real,
	"source" text DEFAULT 'ai' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stage" "flat_stage" DEFAULT 'movein' NOT NULL,
	"is_example" boolean DEFAULT false NOT NULL,
	"address" text NOT NULL,
	"owner_name" text DEFAULT '' NOT NULL,
	"tenant_name" text DEFAULT '' NOT NULL,
	"move_in" date,
	"keys_handed_over" date,
	"monthly_rent" numeric(12, 2),
	"deposit" numeric(12, 2),
	"refund_days" integer,
	"rooms" text[] DEFAULT ARRAY['Entrance','Hall','Kitchen','Bedroom','Bathroom','Balcony']::text[] NOT NULL,
	"next_photo_n" integer DEFAULT 1 NOT NULL,
	"evidence_notes" text DEFAULT '' NOT NULL,
	"deductions_text" text DEFAULT '' NOT NULL,
	"letter" text DEFAULT '' NOT NULL,
	"analyzed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flat_id" uuid NOT NULL,
	"n" integer NOT NULL,
	"room" text NOT NULL,
	"condition" "photo_condition" DEFAULT 'good' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"blob_pathname" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text DEFAULT '' NOT NULL,
	"taken_at" timestamp with time zone,
	"taken_from" text DEFAULT 'file' NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_flat_id_flats_id_fk" FOREIGN KEY ("flat_id") REFERENCES "public"."flats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_flat_id_flats_id_fk" FOREIGN KEY ("flat_id") REFERENCES "public"."flats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_flat_id_flats_id_fk" FOREIGN KEY ("flat_id") REFERENCES "public"."flats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_flat_id_flats_id_fk" FOREIGN KEY ("flat_id") REFERENCES "public"."flats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_runs_flat_idx" ON "ai_runs" USING btree ("flat_id");--> statement-breakpoint
CREATE INDEX "charges_flat_idx" ON "charges" USING btree ("flat_id");--> statement-breakpoint
CREATE INDEX "flats_user_idx" ON "flats" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "photos_flat_n_uq" ON "photos" USING btree ("flat_id","n");--> statement-breakpoint
CREATE INDEX "photos_flat_idx" ON "photos" USING btree ("flat_id");