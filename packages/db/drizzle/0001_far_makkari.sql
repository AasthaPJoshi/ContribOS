CREATE TABLE "worker_jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"deduplication_key" text NOT NULL,
	"status" text DEFAULT 'QUEUED' NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer NOT NULL,
	"available_at" timestamp with time zone NOT NULL,
	"claimed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"dead_at" timestamp with time zone,
	"last_error_code" text,
	"last_error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "worker_jobs_deduplication_key_uq" ON "worker_jobs" USING btree ("deduplication_key");--> statement-breakpoint
CREATE INDEX "worker_jobs_status_available_at_idx" ON "worker_jobs" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX "worker_jobs_claimed_at_idx" ON "worker_jobs" USING btree ("claimed_at");