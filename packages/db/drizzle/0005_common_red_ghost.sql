ALTER TABLE "webhook_deliveries" ADD COLUMN "attempt_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD COLUMN "retryable" boolean DEFAULT false NOT NULL;