import {
  useEffect,
  useMemo,
  useState
} from "react";
import {
  Link,
  useParams
} from "react-router-dom";

import {
  ApiError,
  contribOSApi
} from "../api/client.js";
import type {
  ContributionDecisionTrail,
  ContributionDetail
} from "../api/types.js";
import {
  CurrentStatePanel
} from "../components/current-state-panel.js";
import {
  ErrorState,
  LoadingState
} from "../components/async-state.js";
import {
  EvidenceList
} from "../components/evidence-list.js";
import {
  ReconciliationList
} from "../components/reconciliation-list.js";
import {
  StateHistoryList
} from "../components/state-history-list.js";
import {
  contributionStateSummary,
  decisionTrailSummary
} from "../product/contribution-view-model.js";

interface ContributionPageData {
  detail: ContributionDetail;
  trail: ContributionDecisionTrail;
}

function positiveInteger(
  value: string | undefined
): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const parsed = Number(value);

  return Number.isSafeInteger(parsed)
    ? parsed
    : null;
}

export function ContributionPage() {
  const params = useParams();
  const repositoryId =
    positiveInteger(
      params.repositoryId
    );
  const pullRequestNumber =
    positiveInteger(
      params.pullRequestNumber
    );

  const [data, setData] =
    useState<ContributionPageData | null>(
      null
    );
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    if (
      repositoryId === null ||
      pullRequestNumber === null
    ) {
      setError(
        "The repository or pull request identifier is invalid."
      );
      setLoading(false);
      return;
    }

    const controller =
      new AbortController();

    setLoading(true);
    setError(null);

    void Promise.all([
      contribOSApi.contributionDetail(
        repositoryId,
        pullRequestNumber,
        controller.signal
      ),
      contribOSApi
        .contributionDecisionTrail(
          repositoryId,
          pullRequestNumber,
          100,
          controller.signal
        )
    ])
      .then(([detail, trail]) => {
        setData({
          detail,
          trail
        });
      })
      .catch((cause: unknown) => {
        if (
          controller.signal.aborted
        ) {
          return;
        }

        if (cause instanceof ApiError) {
          setError(
            cause.statusCode === 404
              ? "This contribution is not known to ContribOS."
              : `ContribOS API error: ${cause.reasonCode}`
          );
          return;
        }

        setError(
          "The contribution detail could not be loaded."
        );
      })
      .finally(() => {
        if (
          !controller.signal.aborted
        ) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [
    pullRequestNumber,
    repositoryId
  ]);

  const state = useMemo(
    () =>
      data
        ? contributionStateSummary(
            data.detail
          )
        : null,
    [data]
  );

  const trailSummary = useMemo(
    () =>
      data
        ? decisionTrailSummary(
            data.trail
          )
        : null,
    [data]
  );

  if (loading) {
    return (
      <LoadingState
        label="Loading contribution detail..."
      />
    );
  }

  if (
    error ||
    !data ||
    !state ||
    !trailSummary ||
    repositoryId === null ||
    pullRequestNumber === null
  ) {
    return (
      <ErrorState
        title="Contribution unavailable"
        message={
          error ??
          "The contribution detail is unavailable."
        }
      />
    );
  }

  return (
    <div className="contribution-page">
      <section className="repository-header">
        <div>
          <p className="eyebrow">
            CONTRIBUTION DETAIL
          </p>
          <h2>
            {data.detail.repository.fullName}{" "}
            #{pullRequestNumber}
          </h2>
          <p className="lede compact">
            Deterministic current state,
            next action, evidence, and
            reconciliation history.
          </p>
        </div>

        <div className="repository-actions">
          <Link
            className="secondary-link"
            to={`/repositories/${repositoryId}`}
          >
            Dashboard
          </Link>
          <Link
            className="secondary-link"
            to={`/repositories/${repositoryId}/attention`}
          >
            Attention queue
          </Link>
          <a
            className="button-link"
            href={
              data.detail.contribution.url
            }
            target="_blank"
            rel="noreferrer"
          >
            Open PR
          </a>
        </div>
      </section>

      <CurrentStatePanel
        state={state}
      />

      <section className="trail-summary-grid">
        <article className="metric-card">
          <span className="metric-label">
            State changes
          </span>
          <strong className="metric-value">
            {trailSummary.stateChanges}
          </strong>
        </article>

        <article className="metric-card">
          <span className="metric-label">
            Evidence items
          </span>
          <strong className="metric-value">
            {trailSummary.evidenceItems}
          </strong>
        </article>

        <article className="metric-card">
          <span className="metric-label">
            Reconciliations
          </span>
          <strong className="metric-value">
            {
              trailSummary.reconciliationRuns
            }
          </strong>
        </article>

        <article className="metric-card">
          <span className="metric-label">
            Drift events
          </span>
          <strong className="metric-value">
            {trailSummary.driftEvents}
          </strong>
        </article>
      </section>

      <section className="detail-grid">
        <StateHistoryList
          history={
            data.trail.stateHistory
          }
        />
        <EvidenceList
          evidence={
            data.trail.evidence
          }
        />
      </section>

      <ReconciliationList
        runs={
          data.trail.reconciliationRuns
        }
      />
    </div>
  );
}
