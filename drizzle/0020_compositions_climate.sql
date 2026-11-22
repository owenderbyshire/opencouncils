CREATE TABLE "council_climate" (
	"council_id" text PRIMARY KEY NOT NULL,
	"cape_url" text NOT NULL,
	"plan_count" integer NOT NULL,
	"plan_title" text,
	"plan_url" text,
	"plans_last_update" date,
	"declared_emergency" date,
	"carbon_neutral" text,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "council_compositions" (
	"council_id" text NOT NULL,
	"year" integer NOT NULL,
	"seats" integer NOT NULL,
	"parties" jsonb NOT NULL,
	"control" text,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "council_compositions_council_id_year_pk" PRIMARY KEY("council_id","year")
);
--> statement-breakpoint
CREATE TABLE "council_wdtk" (
	"council_id" text PRIMARY KEY NOT NULL,
	"url_name" text NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL
);
