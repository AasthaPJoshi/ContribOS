import { randomUUID } from "node:crypto";

import {
  desc,
  eq
} from "drizzle-orm";

import type {
  StateEvaluation
} from "@contribos/domain";
import type {
  PullRequestReconciliationResult
} from "@contribos/github";

import type {
  ContribOSDatabase
} from "./database.js";
import {
  contributions,
  evidence,
  reconciliationRuns,
  stateEvaluations,
  stateHistory
} from "./schema.js";

export interface PersistReconciliationInput {
  repositoryId: string;
  pullRequestNumber: number;
  reconciliation:
    PullRequestReconciliationResult;
  evaluation: StateEvaluation;
  startedAt: Date;
  completedAt: Date;
}

export interface PersistReconciliationResult {
  contributionId: string;
  evaluationId: string;
  stateChanged: boolean;
}

export async function persistReconciliationTransaction(
  db: ContribOSDatabase,
  input: PersistReconciliationInput
): Promise<PersistReconciliationResult> {
  const record = input.reconciliation.record;
  const snapshot = input.reconciliation.snapshot;

  if (!record || !snapshot) {
    throw new Error(
      "Stable reconciliation data is required for persistence."
    );
  }

  return db.transaction(async (tx) => {
    const now = new Date();

    const contributionRows = await tx
      .insert(contributions)
      .values({
        id: randomUUID(),
        repositoryId: input.repositoryId,
        githubPullRequestId:
          record.pullRequestId,
        pullRequestNumber:
          input.pullRequestNumber,
        url: record.url,
        headSha: record.headSha,
        latestSnapshot: snapshot,
        lastReconciledAt:
          input.reconciliation.reconciledAt,
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: [
          contributions.repositoryId,
          contributions.pullRequestNumber
        ],
        set: {
          githubPullRequestId:
            record.pullRequestId,
          url: record.url,
          headSha: record.headSha,
          latestSnapshot: snapshot,
          lastReconciledAt:
            input.reconciliation.reconciledAt,
          updatedAt: now
        }
      })
      .returning({
        id: contributions.id
      });

    const contribution =
      contributionRows[0];

    if (!contribution) {
      throw new Error(
        "RECONCILIATION_CONTRIBUTION_UPSERT_FAILED"
      );
    }

    const previousRows = await tx
      .select({
        workflowState:
          stateEvaluations.workflowState
      })
      .from(stateEvaluations)
      .where(
        eq(
          stateEvaluations.contributionId,
          contribution.id
        )
      )
      .orderBy(
        desc(stateEvaluations.evaluatedAt),
        desc(stateEvaluations.createdAt)
      )
      .limit(1);

    const previousWorkflowState =
      previousRows[0]?.workflowState ??
      null;

    for (
      const ref of
      input.reconciliation.evidence
    ) {
      await tx
        .insert(evidence)
        .values({
          id: randomUUID(),
          contributionId:
            contribution.id,
          evidenceId: ref.id,
          source: ref.source,
          objectType: ref.objectType,
          externalId: ref.externalId,
          url: ref.url,
          occurredAt: ref.occurredAt,
          capturedAt: now,
          createdAt: now
        })
        .onConflictDoUpdate({
          target: evidence.evidenceId,
          set: {
            contributionId:
              contribution.id,
            source: ref.source,
            objectType: ref.objectType,
            externalId: ref.externalId,
            url: ref.url,
            occurredAt: ref.occurredAt,
            capturedAt: now
          }
        });
    }

    await tx
      .insert(reconciliationRuns)
      .values({
        id: randomUUID(),
        contributionId:
          contribution.id,
        status:
          input.reconciliation.status,
        reasonCode:
          input.reconciliation.reasonCode,
        headSha:
          input.reconciliation.headSha,
        repairAction:
          input.reconciliation
            .repairDecision.action,
        driftFields:
          input.reconciliation
            .drift?.fields ?? [],
        result: input.reconciliation,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        createdAt: now
      });

    const evaluationId = randomUUID();

    await tx
      .insert(stateEvaluations)
      .values({
        id: evaluationId,
        contributionId:
          contribution.id,
        workflowState:
          input.evaluation.workflowState,
        nextActor:
          input.evaluation.nextActor,
        readiness:
          input.evaluation.readiness,
        reasonCode:
          input.evaluation.reasonCode,
        explanation:
          input.evaluation.explanation,
        engineVersion:
          input.evaluation.engineVersion,
        evaluatedAt:
          input.evaluation.evaluatedAt,
        evaluation: input.evaluation,
        createdAt: now
      });

    const stateChanged =
      previousWorkflowState !==
      input.evaluation.workflowState;

    if (stateChanged) {
      await tx
        .insert(stateHistory)
        .values({
          id: randomUUID(),
          contributionId:
            contribution.id,
          evaluationId,
          fromState:
            previousWorkflowState,
          toState:
            input.evaluation.workflowState,
          reasonCode:
            input.evaluation.reasonCode,
          changedAt:
            input.evaluation.evaluatedAt,
          createdAt: now
        });
    }

    return {
      contributionId:
        contribution.id,
      evaluationId,
      stateChanged
    };
  });
}
