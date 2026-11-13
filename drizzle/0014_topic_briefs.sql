CREATE TABLE "topic_briefs" (
	"id" serial PRIMARY KEY NOT NULL,
	"topic" text NOT NULL,
	"month" text NOT NULL,
	"content" jsonb NOT NULL,
	"model" text NOT NULL,
	"cost_pence" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "topic_briefs_topic_month_idx" ON "topic_briefs" USING btree ("topic","month");