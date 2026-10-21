CREATE TYPE "public"."owner_review_status" AS ENUM('pending', 'confirmed', 'disputed');--> statement-breakpoint
CREATE TABLE "owner_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flat_id" uuid NOT NULL,
	"token" text NOT NULL,
	"photos" jsonb NOT NULL,
	"record_hash" text NOT NULL,
	"status" "owner_review_status" DEFAULT 'pending' NOT NULL,
	"owner_name" text DEFAULT '' NOT NULL,
	"owner_note" text DEFAULT '' NOT NULL,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "owner_reviews" ADD CONSTRAINT "owner_reviews_flat_id_flats_id_fk" FOREIGN KEY ("flat_id") REFERENCES "public"."flats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "owner_reviews_token_uq" ON "owner_reviews" USING btree ("token");--> statement-breakpoint
CREATE INDEX "owner_reviews_flat_idx" ON "owner_reviews" USING btree ("flat_id");