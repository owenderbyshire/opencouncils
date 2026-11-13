CREATE TABLE "planning_applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"authority" text NOT NULL,
	"reference" text,
	"address" text,
	"postcode" text,
	"description" text,
	"app_type" text,
	"app_state" text,
	"app_size" text,
	"start_date" date,
	"consulted_date" date,
	"decided_date" date,
	"target_date" date,
	"decision" text,
	"decided_by" text,
	"ward" text,
	"homes" integer,
	"lat" real,
	"lng" real,
	"url" text,
	"docs_url" text,
	"comment_url" text,
	"planit_link" text,
	"last_changed" timestamp with time zone,
	"council_id" text,
	"meeting_id" integer,
	"agenda_item_id" integer,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscribers" ADD COLUMN "postcode" text;--> statement-breakpoint
ALTER TABLE "subscribers" ADD COLUMN "lat" real;--> statement-breakpoint
ALTER TABLE "subscribers" ADD COLUMN "lng" real;--> statement-breakpoint
ALTER TABLE "subscribers" ADD COLUMN "pending_postcode" text;--> statement-breakpoint
CREATE UNIQUE INDEX "planning_name_idx" ON "planning_applications" USING btree ("name");--> statement-breakpoint
CREATE INDEX "planning_authority_idx" ON "planning_applications" USING btree ("authority","start_date");--> statement-breakpoint
CREATE INDEX "planning_location_idx" ON "planning_applications" USING btree ("lat","lng");--> statement-breakpoint
CREATE INDEX "planning_meeting_idx" ON "planning_applications" USING btree ("council_id","meeting_id");