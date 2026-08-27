import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", {
    withTimezone: true
  })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", {
    withTimezone: true
  })
    .notNull()
    .defaultNow()
};

export const installations = pgTable(
  "installations",
  {
    id: uuid("id").primaryKey(),
    githubInstallationId: text(
      "github_installation_id"
    ).notNull(),
    accountLogin: text("account_login"),
    accountType: text("account_type"),
    permissions: jsonb("permissions")
      .$type<Record<string, string>>()
      .notNull(),
    repositorySelection: text(
      "repository_selection"
    ),
    ...timestamps
  },
  (table) => [
    uniqueIndex(
      "installations_github_installation_id_uq"
    ).on(table.githubInstallationId)
  ]
);

export const repositories = pgTable(
  "repositories",
  {
    id: uuid("id").primaryKey(),
    installationId: uuid("installation_id")
      .notNull()
      .references(() => installations.id, {
        onDelete: "cascade"
      }),
    githubRepositoryId: text(
      "github_repository_id"
    ).notNull(),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    fullName: text("full_name").notNull(),
    defaultBranch: text("default_branch"),
    isPrivate: boolean("is_private")
      .notNull()
      .default(false),
    ...timestamps
  },
  (table) => [
    uniqueIndex(
      "repositories_github_repository_id_uq"
    ).on(table.githubRepositoryId),
    uniqueIndex(
      "repositories_installation_full_name_uq"
    ).on(table.installationId, table.fullName),
    index("repositories_installation_id_idx").on(
      table.installationId
    )
  ]
);

export const contributions = pgTable(
  "contributions",
  {
    id: uuid("id").primaryKey(),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, {
        onDelete: "cascade"
      }),
    githubPullRequestId: text(
      "github_pull_request_id"
    ).notNull(),
    pullRequestNumber: integer(
      "pull_request_number"
    ).notNull(),
    url: text("url").notNull(),
    headSha: text("head_sha").notNull(),
    latestSnapshot: jsonb("latest_snapshot"),
    lastReconciledAt: timestamp(
      "last_reconciled_at",
      {
        withTimezone: true
      }
    ),
    ...timestamps
  },
  (table) => [
    uniqueIndex(
      "contributions_github_pull_request_id_uq"
    ).on(table.githubPullRequestId),
    uniqueIndex(
      "contributions_repository_pr_number_uq"
    ).on(
      table.repositoryId,
      table.pullRequestNumber
    ),
    index("contributions_repository_id_idx").on(
      table.repositoryId
    ),
    index("contributions_head_sha_idx").on(
      table.headSha
    )
  ]
);

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey(),
    deliveryId: text("delivery_id").notNull(),
    eventName: text("event_name"),
    action: text("action"),
    githubInstallationId: text(
      "github_installation_id"
    ),
    githubRepositoryId: text(
      "github_repository_id"
    ),
    status: text("status")
      .notNull()
      .default("CLAIMED"),
    payload: jsonb("payload"),
    receivedAt: timestamp("received_at", {
      withTimezone: true
    }),
    claimedAt: timestamp("claimed_at", {
      withTimezone: true
    })
      .notNull()
      .defaultNow(),
    processedAt: timestamp("processed_at", {
      withTimezone: true
    }),
    errorCode: text("error_code"),
    ...timestamps
  },
  (table) => [
    uniqueIndex(
      "webhook_deliveries_delivery_id_uq"
    ).on(table.deliveryId),
    index(
      "webhook_deliveries_status_claimed_at_idx"
    ).on(table.status, table.claimedAt)
  ]
);

export const evidence = pgTable(
  "evidence",
  {
    id: uuid("id").primaryKey(),
    contributionId: uuid("contribution_id")
      .notNull()
      .references(() => contributions.id, {
        onDelete: "cascade"
      }),
    evidenceId: text("evidence_id").notNull(),
    source: text("source").notNull(),
    objectType: text("object_type").notNull(),
    externalId: text("external_id").notNull(),
    url: text("url").notNull(),
    occurredAt: timestamp("occurred_at", {
      withTimezone: true
    }).notNull(),
    payload: jsonb("payload"),
    capturedAt: timestamp("captured_at", {
      withTimezone: true
    })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", {
      withTimezone: true
    })
      .notNull()
      .defaultNow()
  },
  (table) => [
    uniqueIndex("evidence_evidence_id_uq").on(
      table.evidenceId
    ),
    index("evidence_contribution_id_idx").on(
      table.contributionId
    ),
    index(
      "evidence_object_type_external_id_idx"
    ).on(table.objectType, table.externalId)
  ]
);

export const stateEvaluations = pgTable(
  "state_evaluations",
  {
    id: uuid("id").primaryKey(),
    contributionId: uuid("contribution_id")
      .notNull()
      .references(() => contributions.id, {
        onDelete: "cascade"
      }),
    workflowState: text(
      "workflow_state"
    ).notNull(),
    nextActor: text("next_actor").notNull(),
    readiness: text("readiness").notNull(),
    reasonCode: text("reason_code").notNull(),
    explanation: text("explanation").notNull(),
    engineVersion: text(
      "engine_version"
    ).notNull(),
    evaluatedAt: timestamp("evaluated_at", {
      withTimezone: true
    }).notNull(),
    evaluation: jsonb("evaluation").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true
    })
      .notNull()
      .defaultNow()
  },
  (table) => [
    index(
      "state_evaluations_contribution_evaluated_idx"
    ).on(
      table.contributionId,
      table.evaluatedAt
    )
  ]
);

export const reconciliationRuns = pgTable(
  "reconciliation_runs",
  {
    id: uuid("id").primaryKey(),
    contributionId: uuid("contribution_id")
      .notNull()
      .references(() => contributions.id, {
        onDelete: "cascade"
      }),
    status: text("status").notNull(),
    reasonCode: text("reason_code").notNull(),
    headSha: text("head_sha"),
    repairAction: text("repair_action").notNull(),
    driftFields: jsonb("drift_fields")
      .$type<string[]>()
      .notNull(),
    result: jsonb("result").notNull(),
    startedAt: timestamp("started_at", {
      withTimezone: true
    }).notNull(),
    completedAt: timestamp("completed_at", {
      withTimezone: true
    }).notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true
    })
      .notNull()
      .defaultNow()
  },
  (table) => [
    index(
      "reconciliation_runs_contribution_completed_idx"
    ).on(
      table.contributionId,
      table.completedAt
    )
  ]
);


export const workerJobs = pgTable(
  "worker_jobs",
  {
    id: uuid("id").primaryKey(),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull(),
    deduplicationKey: text("deduplication_key").notNull(),
    status: text("status").notNull().default("QUEUED"),
    attempt: integer("attempt").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull(),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    deadAt: timestamp("dead_at", { withTimezone: true }),
    lastErrorCode: text("last_error_code"),
    lastErrorMessage: text("last_error_message"),
    ...timestamps
  },
  (table) => [
    uniqueIndex("worker_jobs_deduplication_key_uq").on(table.deduplicationKey),
    index("worker_jobs_status_available_at_idx").on(table.status, table.availableAt),
    index("worker_jobs_claimed_at_idx").on(table.claimedAt)
  ]
);

export const stateHistory = pgTable(
  "state_history",
  {
    id: uuid("id").primaryKey(),
    contributionId: uuid("contribution_id")
      .notNull()
      .references(() => contributions.id, {
        onDelete: "cascade"
      }),
    evaluationId: uuid("evaluation_id")
      .notNull()
      .references(() => stateEvaluations.id, {
        onDelete: "cascade"
      }),
    fromState: text("from_state"),
    toState: text("to_state").notNull(),
    reasonCode: text("reason_code").notNull(),
    changedAt: timestamp("changed_at", {
      withTimezone: true
    }).notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true
    })
      .notNull()
      .defaultNow()
  },
  (table) => [
    index(
      "state_history_contribution_changed_idx"
    ).on(table.contributionId, table.changedAt),
    index("state_history_evaluation_id_idx").on(
      table.evaluationId
    )
  ]
);

export type InstallationRow =
  typeof installations.$inferSelect;
export type RepositoryRow =
  typeof repositories.$inferSelect;
export type ContributionRow =
  typeof contributions.$inferSelect;
export type WebhookDeliveryRow =
  typeof webhookDeliveries.$inferSelect;
export type EvidenceRow =
  typeof evidence.$inferSelect;
export type StateEvaluationRow =
  typeof stateEvaluations.$inferSelect;
export type ReconciliationRunRow =
  typeof reconciliationRuns.$inferSelect;
export type WorkerJobRow =
  typeof workerJobs.$inferSelect;
export type StateHistoryRow =
  typeof stateHistory.$inferSelect;
