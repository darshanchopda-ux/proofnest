CREATE TABLE "flat_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flat_id" uuid NOT NULL,
	"token" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "flat_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flat_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"deposit_share" numeric(12, 2),
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phone_links" (
	"phone" text PRIMARY KEY NOT NULL,
	"account_phone" text NOT NULL,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refund_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flat_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"on" date,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sign_ins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"method" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"device" text DEFAULT '' NOT NULL,
	"ip" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "charges" ADD COLUMN "ai_flagged" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "flats" ADD COLUMN "deposit_paid_on" date;--> statement-breakpoint
ALTER TABLE "flats" ADD COLUMN "deposit_paid_to" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "flats" ADD COLUMN "deposit_ref" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "flats" ADD COLUMN "deposit_holder" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "flats" ADD COLUMN "letter_language" text DEFAULT 'English' NOT NULL;--> statement-breakpoint
ALTER TABLE "owner_reviews" ADD COLUMN "kind" text DEFAULT 'movein' NOT NULL;--> statement-breakpoint
ALTER TABLE "owner_reviews" ADD COLUMN "owner_role" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "phase" text DEFAULT 'movein' NOT NULL;--> statement-breakpoint
ALTER TABLE "flat_invites" ADD CONSTRAINT "flat_invites_flat_id_flats_id_fk" FOREIGN KEY ("flat_id") REFERENCES "public"."flats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flat_members" ADD CONSTRAINT "flat_members_flat_id_flats_id_fk" FOREIGN KEY ("flat_id") REFERENCES "public"."flats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_entries" ADD CONSTRAINT "refund_entries_flat_id_flats_id_fk" FOREIGN KEY ("flat_id") REFERENCES "public"."flats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "flat_invites_token_uq" ON "flat_invites" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "flat_members_flat_user_uq" ON "flat_members" USING btree ("flat_id","user_id");--> statement-breakpoint
CREATE INDEX "flat_members_user_idx" ON "flat_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "refund_entries_flat_idx" ON "refund_entries" USING btree ("flat_id");--> statement-breakpoint
CREATE INDEX "sign_ins_user_idx" ON "sign_ins" USING btree ("user_id","created_at");