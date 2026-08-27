import type {
  ContributionDecisionTrail
} from "../api/types.js";
import {
  formatTimestamp
} from "../product/contribution-view-model.js";
import {
  humanizeToken
} from "../product/dashboard-view-model.js";

export function ReconciliationList({
  runs
}: {
  runs:
    ContributionDecisionTrail["reconciliationRuns"];
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">
            RECONCILIATION
          </p>
          <h3>Correctness checks</h3>
        </div>
      </div>

      {runs.length === 0 ? (
        <p className="muted">
          No reconciliation runs recorded.
        </p>
      ) : (
        <ul className="reconciliation-list">
          {runs.map((run) => (
            <li key={run.id}>
              <div className="reconciliation-row">
                <div>
                  <span className="meta-label">
                    Status
                  </span>
                  <strong>
                    {humanizeToken(
                      run.status
                    )}
                  </strong>
                </div>

                <div>
                  <span className="meta-label">
                    Drift
                  </span>
                  <strong>
                    {run.driftFields.length}
                  </strong>
                </div>

                <div>
                  <span className="meta-label">
                    Repair
                  </span>
                  <strong>
                    {run.repairAction
                      ? humanizeToken(
                          run.repairAction
                        )
                      : "None"}
                  </strong>
                </div>
              </div>

              <p className="muted">
                Started{" "}
                {formatTimestamp(
                  run.startedAt
                )}
              </p>

              {run.reasonCode ? (
                <p className="run-reason">
                  {humanizeToken(
                    run.reasonCode
                  )}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
