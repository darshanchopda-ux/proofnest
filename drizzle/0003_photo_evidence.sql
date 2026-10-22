ALTER TABLE "photos" ADD COLUMN "capture" text DEFAULT 'upload' NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "day_code" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "tsa_token" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "tsa_time" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "tsa_authority" text DEFAULT '' NOT NULL;