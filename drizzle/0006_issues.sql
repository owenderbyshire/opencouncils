CREATE TABLE "issue_items" (
	"council_id" text NOT NULL,
	"issue_id" integer NOT NULL,
	"agenda_item_id" integer NOT NULL,
	"meeting_id" integer NOT NULL,
	"date" date NOT NULL,
	CONSTRAINT "issue_items_council_id_agenda_item_id_pk" PRIMARY KEY("council_id","agenda_item_id")
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"council_id" text NOT NULL,
	"id" integer NOT NULL,
	"title_en" text NOT NULL,
	"title_cy" text,
	"first_date" date NOT NULL,
	"last_date" date NOT NULL,
	"steps" smallint NOT NULL,
	"kinds" text[] DEFAULT '{}'::text[] NOT NULL,
	"topics" text[] DEFAULT '{}'::text[] NOT NULL,
	"decided" boolean DEFAULT false NOT NULL,
	CONSTRAINT "issues_council_id_id_pk" PRIMARY KEY("council_id","id")
);
--> statement-breakpoint
CREATE INDEX "issue_items_issue_idx" ON "issue_items" USING btree ("council_id","issue_id");--> statement-breakpoint
CREATE INDEX "issues_last_idx" ON "issues" USING btree ("last_date");