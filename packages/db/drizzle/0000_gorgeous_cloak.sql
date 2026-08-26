CREATE TABLE "contributions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"repository_id" uuid NOT NULL,
	"github_pull_request_id" text NOT NULL,
	"pull_request_number" integer NOT NULL,
	"url" text NOT NULL,
	"head_sha" text NOT NULL,
	"latest_snapshot" jsonb,
	"last_reconciled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY NOT NULL,
	"contribution_id" uuid NOT NULL,
	"evidence_id" text NOT NULL,
	"source" text NOT NULL,
	"object_type" text NOT NULL,
	"external_id" text NOT NULL,
	"url" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"payload" jsonb,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "installations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"github_installation_id" text NOT NULL,
	"account_login" text,
	"account_type" text,
	"permissions" jsonb NOT NULL,
	"repository_selection" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reconciliation_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"contribution_id" uuid NOT NULL,
	"status" text NOT NULL,
	"reason_code" text NOT NULL,
	"head_sha" text,
	"repair_action" text NOT NULL,
	"drift_fields" jsonb NOT NULL,
	"result" jsonb NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repositories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"installation_id" uuid NOT NULL,
	"github_repository_id" text NOT NULL,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"full_name" text NOT NULL,
	"default_branch" text,
	"is_private" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "state_evaluations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"contribution_id" uuid NOT NULL,
	"workflow_state" text NOT NULL,
	"next_actor" text NOT NULL,
	"readiness" text NOT NULL,
	"reason_code" text NOT NULL,
	"explanation" text NOT NULL,
	"engine_version" text NOT NULL,
	"evaluated_at" timestamp with time zone NOT NULL,
	"evaluation" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "state_history" (
	"id" uuid PRIMARY KEY NOT NULL,
	"contribution_id" uuid NOT NULL,
	"evaluation_id" uuid NOT NULL,
	"from_state" text,
	"to_state" text NOT NULL,
	"reason_code" text NOT NULL,
	"changed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"delivery_id" text NOT NULL,
	"event_name" text,
	"action" text,
	"github_installation_id" text,
	"github_repository_id" text,
	"status" text DEFAULT 'CLAIMED' NOT NULL,
	"payload" jsonb,
	"received_at" timestamp with time zone,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_contribution_id_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_runs" ADD CONSTRAINT "reconciliation_runs_contribution_id_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_installation_id_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "state_evaluations" ADD CONSTRAINT "state_evaluations_contribution_id_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "state_history" ADD CONSTRAINT "state_history_contribution_id_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "state_history" ADD CONSTRAINT "state_history_evaluation_id_state_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."state_evaluations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contributions_github_pull_request_id_uq" ON "contributions" USING btree ("github_pull_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contributions_repository_pr_number_uq" ON "contributions" USING btree ("repository_id","pull_request_number");--> statement-breakpoint
CREATE INDEX "contributions_repository_id_idx" ON "contributions" USING btree ("repository_id");--> statement-breakpoint
CREATE INDEX "contributions_head_sha_idx" ON "contributions" USING btree ("head_sha");--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_evidence_id_uq" ON "evidence" USING btree ("evidence_id");--> statement-breakpoint
CREATE INDEX "evidence_contribution_id_idx" ON "evidence" USING btree ("contribution_id");--> statement-breakpoint
CREATE INDEX "evidence_object_type_external_id_idx" ON "evidence" USING btree ("object_type","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "installations_github_installation_id_uq" ON "installations" USING btree ("github_installation_id");--> statement-breakpoint
CREATE INDEX "reconciliation_runs_contribution_completed_idx" ON "reconciliation_runs" USING btree ("contribution_id","completed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "repositories_github_repository_id_uq" ON "repositories" USING btree ("github_repository_id");--> statement-breakpoint
CREATE UNIQUE INDEX "repositories_installation_full_name_uq" ON "repositories" USING btree ("installation_id","full_name");--> statement-breakpoint
CREATE INDEX "repositories_installation_id_idx" ON "repositories" USING btree ("installation_id");--> statement-breakpoint
CREATE INDEX "state_evaluations_contribution_evaluated_idx" ON "state_evaluations" USING btree ("contribution_id","evaluated_at");--> statement-breakpoint
CREATE INDEX "state_history_contribution_changed_idx" ON "state_history" USING btree ("contribution_id","changed_at");--> statement-breakpoint
CREATE INDEX "state_history_evaluation_id_idx" ON "state_history" USING btree ("evaluation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_deliveries_delivery_id_uq" ON "webhook_deliveries" USING btree ("delivery_id");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_status_claimed_at_idx" ON "webhook_deliveries" USING btree ("status","claimed_at");