import type {
  ContributionDecisionTrail
} from "../api/types.js";
import {
  formatTimestamp
} from "../product/contribution-view-model.js";
import {
  humanizeToken
} from "../product/dashboard-view-model.js";

export function StateHistoryList({
  history
}: {
  history:
    ContributionDecisionTrail["stateHistory"];
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">
            STATE HISTORY
          </p>
          <h3>Workflow transitions</h3>
        </div>
      </div>

      {history.length === 0 ? (
        <p className="muted">
          No state transitions recorded.
        </p>
      ) : (
        <ol className="timeline-list">
          {history.map((item) => (
            <li key={item.id}>
              <div className="timeline-dot" />
              <div>
                <strong>
                  {item.fromState
                    ? `${humanizeToken(
                        item.fromState
                      )} to ${humanizeToken(
                        item.toState
                      )}`
                    : humanizeToken(
                        item.toState
                      )}
                </strong>
                <p>
                  {humanizeToken(
                    item.reasonCode
                  )}
                </p>
                <time>
                  {formatTimestamp(
                    item.changedAt
                  )}
                </time>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
