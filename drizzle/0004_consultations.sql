CREATE TABLE "consultations" (
	"url" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"council_id" text,
	"type_en" text,
	"title_en" text NOT NULL,
	"title_cy" text,
	"url_cy" text,
	"summary_en" text,
	"summary_cy" text,
	"area" text,
	"opens" date,
	"closes" date,
	"open" boolean DEFAULT true NOT NULL,
	"topics" text[] DEFAULT '{}'::text[] NOT NULL,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "consultations_closes_idx" ON "consultations" USING btree ("closes");--> statement-breakpoint
CREATE INDEX "consultations_council_idx" ON "consultations" USING btree ("council_id","open");