import type {
  ContributionDecisionTrail
} from "../api/types.js";
import {
  formatTimestamp
} from "../product/contribution-view-model.js";
import {
  humanizeToken
} from "../product/dashboard-view-model.js";

export function EvidenceList({
  evidence
}: {
  evidence:
    ContributionDecisionTrail["evidence"];
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">
            EVIDENCE
          </p>
          <h3>GitHub evidence trail</h3>
        </div>
      </div>

      {evidence.length === 0 ? (
        <p className="muted">
          No evidence references recorded.
        </p>
      ) : (
        <ul className="evidence-list">
          {evidence.map((item) => (
            <li key={item.id}>
              <div>
                <strong>
                  {humanizeToken(
                    item.objectType
                  )}
                </strong>
                <p>
                  External ID:{" "}
                  {item.externalId}
                </p>
                <small>
                  Captured{" "}
                  {formatTimestamp(
                    item.capturedAt
                  )}
                </small>
              </div>

              {item.url ? (
                <a
                  className="secondary-link"
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open evidence
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
