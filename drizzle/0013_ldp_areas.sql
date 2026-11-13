CREATE TABLE "ldp_area_applications" (
	"area_id" integer NOT NULL,
	"application" text NOT NULL,
	CONSTRAINT "ldp_area_applications_area_id_application_pk" PRIMARY KEY("area_id","application")
);
--> statement-breakpoint
CREATE TABLE "ldp_areas" (
	"id" serial PRIMARY KEY NOT NULL,
	"authority" text NOT NULL,
	"layer" text NOT NULL,
	"use" text NOT NULL,
	"ref" text,
	"name" text,
	"geometry" jsonb NOT NULL,
	"props" jsonb,
	"min_lng" double precision NOT NULL,
	"min_lat" double precision NOT NULL,
	"max_lng" double precision NOT NULL,
	"max_lat" double precision NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ldp_area_app_idx" ON "ldp_area_applications" USING btree ("application");--> statement-breakpoint
CREATE INDEX "ldp_areas_authority_idx" ON "ldp_areas" USING btree ("authority");