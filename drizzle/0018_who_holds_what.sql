CREATE TABLE "executive_posts" (
	"council_id" text NOT NULL,
	"post_id" integer NOT NULL,
	"councillor_id" integer NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "executive_posts_council_id_post_id_councillor_id_pk" PRIMARY KEY("council_id","post_id","councillor_id")
);
--> statement-breakpoint
CREATE TABLE "source_reads" (
	"council_id" text NOT NULL,
	"source" text NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	"outcome" text NOT NULL,
	"rows" integer DEFAULT 0 NOT NULL,
	"note" text,
	CONSTRAINT "source_reads_council_id_source_pk" PRIMARY KEY("council_id","source")
);
--> statement-breakpoint
CREATE INDEX "executive_posts_councillor_idx" ON "executive_posts" USING btree ("council_id","councillor_id");