import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import type {
  StateEvaluation
} from "@contribos/domain";
import type {
  PullRequestReconciliationResult
} from "@contribos/github";

import type { ContribOSDatabase } from "./database.js";
import {
  contributions,
  evidence,
  reconciliationRuns,
  stateEvaluations,
  stateHistory
} from "./schema.js";

export interface PersistReconciliationInput {
  contributionId: string;
  reconciliation: PullRequestReconciliationResult;
  evaluation: StateEvaluation;
  previousWorkflowState?: string | null;
  startedAt: Date;
  completedAt: Date;
}

export async function persistReconciliationTransaction(
  db: ContribOSDatabase,
  input: PersistReconciliationInput
): Promise<void> {
  await db.transaction(async (tx) => {
    const evaluationId = randomUUID();

    await tx
      .update(contributions)
      .set({
        headSha:
          input.reconciliation.headSha ??
          undefined,
        latestSnapshot:
          input.reconciliation.snapshot,
        lastReconciledAt:
          input.reconciliation.reconciledAt,
        updatedAt: new Date()
      })
      .where(
        eq(
          contributions.id,
          input.contributionId
        )
      );

    for (const ref of input.reconciliation.evidence) {
      await tx
        .insert(evidence)
        .values({
          id: randomUUID(),
          contributionId:
            input.contributionId,
          evidenceId: ref.id,
          source: ref.source,
          objectType: ref.objectType,
          externalId: ref.externalId,
          url: ref.url,
          occurredAt: ref.occurredAt,
          capturedAt: new Date(),
          createdAt: new Date()
        })
        .onConflictDoUpdate({
          target: evidence.evidenceId,
          set: {
            contributionId:
              input.contributionId,
            source: ref.source,
            objectType: ref.objectType,
            externalId: ref.externalId,
            url: ref.url,
            occurredAt: ref.occurredAt,
            capturedAt: new Date()
          }
        });
    }

    await tx.insert(reconciliationRuns).values({
      id: randomUUID(),
      contributionId:
        input.contributionId,
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
        input.reconciliation.drift?.fields ?? [],
      result: input.reconciliation,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      createdAt: new Date()
    });

    await tx.insert(stateEvaluations).values({
      id: evaluationId,
      contributionId:
        input.contributionId,
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
      createdAt: new Date()
    });

    await tx.insert(stateHistory).values({
      id: randomUUID(),
      contributionId:
        input.contributionId,
      evaluationId,
      fromState:
        input.previousWorkflowState ?? null,
      toState:
        input.evaluation.workflowState,
      reasonCode:
        input.evaluation.reasonCode,
      changedAt:
        input.evaluation.evaluatedAt,
      createdAt: new Date()
    });
  });
}
