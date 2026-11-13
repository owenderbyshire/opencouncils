CREATE TABLE "ldp_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"authority" text NOT NULL,
	"kind" text NOT NULL,
	"url" text NOT NULL,
	"hash" text,
	"page_count" integer,
	"read_version" integer,
	"cost_pence" real DEFAULT 0 NOT NULL,
	"problem" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ldp_facts" (
	"id" serial PRIMARY KEY NOT NULL,
	"authority" text NOT NULL,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"value" double precision NOT NULL,
	"url" text NOT NULL,
	"page" integer NOT NULL,
	"quote" text NOT NULL,
	"mentions" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ldp_sites" (
	"id" serial PRIMARY KEY NOT NULL,
	"authority" text NOT NULL,
	"kind" text NOT NULL,
	"ref" text,
	"name" text NOT NULL,
	"settlement" text,
	"use" text NOT NULL,
	"homes" integer,
	"hectares" double precision,
	"url" text NOT NULL,
	"page" integer NOT NULL,
	"quote" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ldp_documents_url_idx" ON "ldp_documents" USING btree ("authority","kind","url");--> statement-breakpoint
CREATE INDEX "ldp_facts_authority_idx" ON "ldp_facts" USING btree ("authority","kind");--> statement-breakpoint
CREATE INDEX "ldp_sites_authority_idx" ON "ldp_sites" USING btree ("authority","kind");