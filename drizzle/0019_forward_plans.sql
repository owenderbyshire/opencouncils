CREATE TABLE "planned_decisions" (
	"council_id" text NOT NULL,
	"issue_id" integer NOT NULL,
	"title" text NOT NULL,
	"purpose" text,
	"makers" text DEFAULT '' NOT NULL,
	"executive" boolean DEFAULT false NOT NULL,
	"due" date,
	"due_month_only" boolean DEFAULT false NOT NULL,
	"executive_due" date,
	"is_key" boolean,
	"status" text,
	"lead_member" text,
	"lead_director" text,
	"restriction" text,
	"notice_published" date,
	"topics" text[] DEFAULT '{}'::text[] NOT NULL,
	"url" text NOT NULL,
	"listed" boolean DEFAULT true NOT NULL,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"detail_fetched_at" timestamp with time zone,
	"detail_hash" text,
	"taken_meeting_id" integer,
	"taken_item_id" integer,
	CONSTRAINT "planned_decisions_council_id_issue_id_pk" PRIMARY KEY("council_id","issue_id")
);
--> statement-breakpoint
CREATE INDEX "planned_decisions_due_idx" ON "planned_decisions" USING btree ("due");--> statement-breakpoint
CREATE INDEX "planned_decisions_listed_idx" ON "planned_decisions" USING btree ("council_id","listed");