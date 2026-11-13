CREATE TABLE "search_items" (
	"council_id" text NOT NULL,
	"agenda_item_id" integer NOT NULL,
	"meeting_id" integer NOT NULL,
	"committee_id" integer NOT NULL,
	"committee_kind" text NOT NULL,
	"date" date NOT NULL,
	"title" text NOT NULL,
	"decision" text,
	"headline_en" text,
	"headline_cy" text,
	"decided_en" text,
	"decided_cy" text,
	"body" text,
	"topics" text[] DEFAULT '{}'::text[] NOT NULL,
	"tsv" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(headline_en, '')), 'A')
        || setweight(to_tsvector('english', coalesce(decided_en, '') || ' ' || coalesce(decision, '')), 'B')
        || setweight(to_tsvector('simple', coalesce(headline_cy, '') || ' ' || coalesce(decided_cy, '')), 'B')
        || setweight(to_tsvector('english', coalesce(body, '')), 'D')) STORED,
	CONSTRAINT "search_items_council_id_agenda_item_id_pk" PRIMARY KEY("council_id","agenda_item_id")
);
--> statement-breakpoint
CREATE INDEX "search_items_tsv_idx" ON "search_items" USING gin ("tsv");--> statement-breakpoint
CREATE INDEX "search_items_topics_idx" ON "search_items" USING gin ("topics");--> statement-breakpoint
CREATE INDEX "search_items_date_idx" ON "search_items" USING btree ("date");