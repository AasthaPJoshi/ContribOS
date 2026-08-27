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
  AttentionQueuePage
} from "../api/types.js";
import {
  AttentionItemCard
} from "../components/attention-item.js";
import {
  AttentionSummaryCards
} from "../components/attention-summary.js";
import {
  EmptyState,
  ErrorState,
  LoadingState
} from "../components/async-state.js";
import {
  summarizeAttention
} from "../product/attention-view-model.js";

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

export function AttentionPage() {
  const params = useParams();
  const repositoryId =
    parseRepositoryId(
      params.repositoryId
    );

  const [page, setPage] =
    useState<AttentionQueuePage | null>(
      null
    );
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState<string | null>(null);

  const [workflowState, setWorkflowState] =
    useState("");
  const [readiness, setReadiness] =
    useState("");
  const [nextActor, setNextActor] =
    useState("");
  const [pageNumber, setPageNumber] =
    useState(1);

  const query = useMemo(
    () => ({
      page: pageNumber,
      pageSize: 25,
      ...(workflowState
        ? { workflowState }
        : {}),
      ...(readiness
        ? { readiness }
        : {}),
      ...(nextActor
        ? { nextActor }
        : {})
    }),
    [
      nextActor,
      pageNumber,
      readiness,
      workflowState
    ]
  );

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

    void contribOSApi
      .attentionQueue(
        repositoryId,
        query,
        controller.signal
      )
      .then((result) => {
        setPage(result);
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
              ? "This repository is not known to ContribOS yet."
              : `ContribOS API error: ${cause.reasonCode}`
          );
          return;
        }

        setError(
          "The maintainer attention queue could not be loaded."
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
  }, [query, repositoryId]);

  if (loading) {
    return (
      <LoadingState
        label="Loading maintainer attention queue..."
      />
    );
  }

  if (
    error ||
    !page ||
    repositoryId === null
  ) {
    return (
      <ErrorState
        title="Attention queue unavailable"
        message={
          error ??
          "The attention queue is unavailable."
        }
      />
    );
  }

  const summary =
    summarizeAttention(page);

  return (
    <div className="attention-page">
      <section className="repository-header">
        <div>
          <p className="eyebrow">
            MAINTAINER ATTENTION
          </p>
          <h2>Attention Queue</h2>
          <p className="lede compact">
            Ranked deterministically from
            workflow state, readiness, and
            next-action ownership.
          </p>
        </div>

        <Link
          className="secondary-link"
          to={`/repositories/${repositoryId}`}
        >
          Back to dashboard
        </Link>
      </section>

      <AttentionSummaryCards
        summary={summary}
      />

      <section className="filter-panel">
        <div>
          <label htmlFor="workflow-filter">
            Workflow state
          </label>
          <input
            id="workflow-filter"
            value={workflowState}
            placeholder="READY_TO_MERGE"
            onChange={(event) => {
              setWorkflowState(
                event.target.value
                  .trim()
                  .toUpperCase()
              );
              setPageNumber(1);
            }}
          />
        </div>

        <div>
          <label htmlFor="readiness-filter">
            Readiness
          </label>
          <input
            id="readiness-filter"
            value={readiness}
            placeholder="READY_FOR_REVIEW"
            onChange={(event) => {
              setReadiness(
                event.target.value
                  .trim()
                  .toUpperCase()
              );
              setPageNumber(1);
            }}
          />
        </div>

        <div>
          <label htmlFor="actor-filter">
            Next actor
          </label>
          <input
            id="actor-filter"
            value={nextActor}
            placeholder="MAINTAINER"
            onChange={(event) => {
              setNextActor(
                event.target.value
                  .trim()
                  .toUpperCase()
              );
              setPageNumber(1);
            }}
          />
        </div>
      </section>

      {page.items.length === 0 ? (
        <EmptyState
          title="Nothing needs attention"
          message="No contributions match the current filters."
        />
      ) : (
        <section className="attention-list">
          {page.items.map((item) => (
            <AttentionItemCard
              key={item.id}
              repositoryId={repositoryId}
              item={item}
            />
          ))}
        </section>
      )}

      <nav
        className="pagination"
        aria-label="Attention queue pages"
      >
        <button
          type="button"
          disabled={page.page <= 1}
          onClick={() =>
            setPageNumber((value) =>
              Math.max(1, value - 1)
            )
          }
        >
          Previous
        </button>

        <span>
          Page {page.page} of{" "}
          {Math.max(
            1,
            page.totalPages
          )}
        </span>

        <button
          type="button"
          disabled={
            page.totalPages === 0 ||
            page.page >= page.totalPages
          }
          onClick={() =>
            setPageNumber((value) =>
              value + 1
            )
          }
        >
          Next
        </button>
      </nav>
    </div>
  );
}
