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
  RepositoryDashboard,
  RepositoryOverview
} from "../api/types.js";
import {
  CountList
} from "../components/count-list.js";
import {
  ContributionTable
} from "../components/contribution-table.js";
import {
  ErrorState,
  LoadingState
} from "../components/async-state.js";
import {
  MetricCard
} from "../components/metric-card.js";
import {
  countEntries,
  dashboardMetrics,
  recentContributions
} from "../product/dashboard-view-model.js";

interface RepositoryPageData {
  overview: RepositoryOverview;
  dashboard: RepositoryDashboard;
}

function parseRepositoryId(
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

export function RepositoryPage() {
  const params = useParams();
  const repositoryId =
    parseRepositoryId(
      params.repositoryId
    );

  const [data, setData] =
    useState<RepositoryPageData | null>(
      null
    );
  const [error, setError] =
    useState<string | null>(null);
  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    if (repositoryId === null) {
      setError(
        "The repository ID is invalid."
      );
      setLoading(false);
      return;
    }

    const controller =
      new AbortController();

    setLoading(true);
    setError(null);

    void Promise.all([
      contribOSApi.repositoryOverview(
        repositoryId,
        controller.signal
      ),
      contribOSApi.repositoryDashboard(
        repositoryId,
        controller.signal
      )
    ])
      .then(
        ([overview, dashboard]) => {
          setData({
            overview,
            dashboard
          });
        }
      )
      .catch((cause: unknown) => {
        if (
          controller.signal.aborted
        ) {
          return;
        }

        if (cause instanceof ApiError) {
          setError(
            cause.statusCode === 404
              ? "This repository is not known to ContribOS yet."
              : `ContribOS API error: ${cause.reasonCode}`
          );
          return;
        }

        setError(
          "The repository dashboard could not be loaded."
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
  }, [repositoryId]);

  const metrics = useMemo(
    () =>
      data
        ? dashboardMetrics(
            data.dashboard
          )
        : [],
    [data]
  );

  if (loading) {
    return (
      <LoadingState
        label="Loading repository dashboard..."
      />
    );
  }

  if (error || !data || repositoryId === null) {
    return (
      <ErrorState
        title="Repository unavailable"
        message={
          error ??
          "The repository dashboard is unavailable."
        }
      />
    );
  }

  const {
    overview,
    dashboard
  } = data;

  return (
    <div className="dashboard-page">
      <section className="repository-header">
        <div>
          <p className="eyebrow">
            REPOSITORY CONTROL PLANE
          </p>
          <h2>
            {overview.repository.fullName}
          </h2>
          <p className="lede compact">
            Deterministic contribution
            state, ownership, readiness,
            and maintainer attention.
          </p>
        </div>

        <div className="repository-actions">
          <Link
            className="button-link"
            to={`/repositories/${repositoryId}/attention`}
          >
            Open attention queue
          </Link>

          <a
            className="secondary-link"
            href={`https://github.com/${overview.repository.fullName}`}
            target="_blank"
            rel="noreferrer"
          >
            View on GitHub
          </a>
        </div>
      </section>

      <section
        className="metric-grid"
        aria-label="Repository metrics"
      >
        {metrics.map((metric) => (
          <MetricCard
            key={metric.label}
            metric={metric}
          />
        ))}
      </section>

      <section className="dashboard-grid">
        <CountList
          title="Workflow state"
          entries={countEntries(
            dashboard.byWorkflowState
          )}
        />
        <CountList
          title="Readiness"
          entries={countEntries(
            dashboard.byReadiness
          )}
        />
        <CountList
          title="Next actor"
          entries={countEntries(
            dashboard.byNextActor
          )}
        />
      </section>

      <ContributionTable
        repositoryId={repositoryId}
        contributions={recentContributions(
          overview.contributions
        )}
      />
    </div>
  );
}
