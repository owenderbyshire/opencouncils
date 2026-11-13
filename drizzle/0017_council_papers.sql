CREATE TABLE "council_papers" (
	"council_id" text NOT NULL,
	"kind" text NOT NULL,
	"meeting_id" integer NOT NULL,
	"item_id" integer,
	"date" date NOT NULL,
	"committee" text NOT NULL,
	"title" text NOT NULL,
	"documents" jsonb NOT NULL,
	"content" jsonb NOT NULL,
	"model" text NOT NULL,
	"cost_pence" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "council_papers_council_id_kind_pk" PRIMARY KEY("council_id","kind")
);
