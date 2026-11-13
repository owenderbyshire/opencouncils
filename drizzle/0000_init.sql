CREATE TABLE "agenda_items" (
	"council_id" text NOT NULL,
	"id" integer NOT NULL,
	"meeting_id" integer NOT NULL,
	"seq" smallint NOT NULL,
	"number" text,
	"title" text NOT NULL,
	"is_decision" boolean DEFAULT false NOT NULL,
	"is_restricted" boolean DEFAULT false NOT NULL,
	"declaration_count" smallint DEFAULT 0 NOT NULL,
	"agenda_text" text,
	"minutes" text,
	CONSTRAINT "agenda_items_council_id_id_pk" PRIMARY KEY("council_id","id")
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"council_id" text NOT NULL,
	"meeting_id" integer NOT NULL,
	"councillor_id" integer NOT NULL,
	"status" text NOT NULL,
	"status_raw" text,
	"role" text,
	CONSTRAINT "attendance_council_id_meeting_id_councillor_id_pk" PRIMARY KEY("council_id","meeting_id","councillor_id")
);
--> statement-breakpoint
CREATE TABLE "committee_members" (
	"council_id" text NOT NULL,
	"committee_id" integer NOT NULL,
	"councillor_id" integer NOT NULL,
	"role" text NOT NULL,
	"role_raw" text,
	CONSTRAINT "committee_members_council_id_committee_id_councillor_id_pk" PRIMARY KEY("council_id","committee_id","councillor_id")
);
--> statement-breakpoint
CREATE TABLE "committees" (
	"council_id" text NOT NULL,
	"id" integer NOT NULL,
	"name_en" text NOT NULL,
	"name_cy" text,
	"category" text,
	"kind" text DEFAULT 'other' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "committees_council_id_id_pk" PRIMARY KEY("council_id","id")
);
--> statement-breakpoint
CREATE TABLE "councillors" (
	"council_id" text NOT NULL,
	"id" integer NOT NULL,
	"name" text NOT NULL,
	"honorific" text,
	"ward_slug" text,
	"party_label" text,
	"party_id" text,
	"group_label" text,
	"photo_url" text,
	"email" text,
	"phone" text,
	"key_posts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"term_start" date,
	"current" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "councillors_council_id_id_pk" PRIMARY KEY("council_id","id")
);
--> statement-breakpoint
CREATE TABLE "councils" (
	"id" text PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"name_cy" text NOT NULL,
	"moderngov_base" text,
	"website" text,
	"active" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"council_id" text NOT NULL,
	"meeting_id" integer NOT NULL,
	"agenda_item_id" integer NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "declarations" (
	"id" serial PRIMARY KEY NOT NULL,
	"council_id" text NOT NULL,
	"meeting_id" integer NOT NULL,
	"councillor_id" integer,
	"name_as_recorded" text NOT NULL,
	"agenda_item_id" integer,
	"item_as_recorded" text,
	"kind" text NOT NULL,
	"nature_en" text,
	"nature_cy" text,
	"source" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"council_id" text NOT NULL,
	"id" integer NOT NULL,
	"meeting_id" integer NOT NULL,
	"agenda_item_id" integer,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"published" date,
	"is_decision_attachment" boolean DEFAULT false NOT NULL,
	"text" text,
	"pages" smallint,
	CONSTRAINT "documents_council_id_id_pk" PRIMARY KEY("council_id","id")
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"council_id" text NOT NULL,
	"id" integer NOT NULL,
	"committee_id" integer NOT NULL,
	"date" date NOT NULL,
	"start_time" text,
	"status" text,
	"cancelled" boolean DEFAULT false NOT NULL,
	"location" text,
	"agenda_published" boolean DEFAULT false NOT NULL,
	"minutes_published" boolean DEFAULT false NOT NULL,
	"decisions_published" boolean DEFAULT false NOT NULL,
	"detail_hash" text,
	"detail_fetched_at" timestamp with time zone,
	CONSTRAINT "meetings_council_id_id_pk" PRIMARY KEY("council_id","id")
);
--> statement-breakpoint
CREATE TABLE "pipeline_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"stats" jsonb,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "pipeline_state" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "summaries" (
	"id" serial PRIMARY KEY NOT NULL,
	"council_id" text NOT NULL,
	"meeting_id" integer NOT NULL,
	"prompt_version" text NOT NULL,
	"input_hash" text NOT NULL,
	"model" text NOT NULL,
	"content" jsonb NOT NULL,
	"cost_pence" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wards" (
	"council_id" text NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_cy" text,
	"seats" smallint,
	CONSTRAINT "wards_council_id_slug_pk" PRIMARY KEY("council_id","slug")
);
--> statement-breakpoint
CREATE INDEX "agenda_items_meeting_idx" ON "agenda_items" USING btree ("council_id","meeting_id","seq");--> statement-breakpoint
CREATE INDEX "attendance_councillor_idx" ON "attendance" USING btree ("council_id","councillor_id");--> statement-breakpoint
CREATE INDEX "committee_members_councillor_idx" ON "committee_members" USING btree ("council_id","councillor_id");--> statement-breakpoint
CREATE INDEX "councillors_ward_idx" ON "councillors" USING btree ("council_id","ward_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "decisions_item_idx" ON "decisions" USING btree ("council_id","agenda_item_id");--> statement-breakpoint
CREATE INDEX "decisions_meeting_idx" ON "decisions" USING btree ("council_id","meeting_id");--> statement-breakpoint
CREATE INDEX "declarations_meeting_idx" ON "declarations" USING btree ("council_id","meeting_id");--> statement-breakpoint
CREATE INDEX "declarations_councillor_idx" ON "declarations" USING btree ("council_id","councillor_id");--> statement-breakpoint
CREATE INDEX "documents_meeting_idx" ON "documents" USING btree ("council_id","meeting_id");--> statement-breakpoint
CREATE INDEX "meetings_date_idx" ON "meetings" USING btree ("council_id","date");--> statement-breakpoint
CREATE INDEX "meetings_committee_idx" ON "meetings" USING btree ("council_id","committee_id","date");--> statement-breakpoint
CREATE INDEX "pipeline_runs_job_idx" ON "pipeline_runs" USING btree ("job","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "summaries_meeting_idx" ON "summaries" USING btree ("council_id","meeting_id","prompt_version");