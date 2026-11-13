CREATE TABLE "alert_log" (
	"subscriber_id" text NOT NULL,
	"key" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alert_log_subscriber_id_key_pk" PRIMARY KEY("subscriber_id","key")
);
--> statement-breakpoint
ALTER TABLE "subscribers" ADD COLUMN "keywords" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "subscribers" ADD COLUMN "pending_keywords" text[];--> statement-breakpoint
ALTER TABLE "subscribers" ADD COLUMN "instant" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "subscribers" ADD COLUMN "pending_instant" boolean;