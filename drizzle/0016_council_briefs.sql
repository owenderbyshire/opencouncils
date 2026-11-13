CREATE TABLE "council_briefs" (
	"id" serial PRIMARY KEY NOT NULL,
	"council_id" text NOT NULL,
	"month" text NOT NULL,
	"content" jsonb NOT NULL,
	"model" text NOT NULL,
	"cost_pence" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "council_briefs_council_month_idx" ON "council_briefs" USING btree ("council_id","month");