CREATE TABLE "ldp_points" (
	"id" serial PRIMARY KEY NOT NULL,
	"authority" text NOT NULL,
	"kind" text NOT NULL,
	"topic" text NOT NULL,
	"seq" integer NOT NULL,
	"text_en" text NOT NULL,
	"text_cy" text NOT NULL,
	"policy" text,
	"url" text NOT NULL,
	"page" integer NOT NULL,
	"quote" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ldp_documents" ADD COLUMN "summary_version" integer;--> statement-breakpoint
CREATE INDEX "ldp_points_authority_idx" ON "ldp_points" USING btree ("authority","kind");