import {
  Link
} from "react-router-dom";

import type {
  RepositoryContributionSummary
} from "../api/types.js";
import {
  humanizeToken
} from "../product/dashboard-view-model.js";

function stateLabel(
  value: string | null
): string {
  return value
    ? humanizeToken(value)
    : "Unknown";
}

export function ContributionTable({
  repositoryId,
  contributions
}: {
  repositoryId: number;
  contributions:
    RepositoryContributionSummary[];
}) {
  return (
    <section className="panel contribution-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">
            CONTRIBUTIONS
          </p>
          <h3>Recent pull requests</h3>
        </div>
      </div>

      {contributions.length === 0 ? (
        <p className="muted">
          No contributions have been
          recorded for this repository.
        </p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>PR</th>
                <th>Workflow</th>
                <th>Next actor</th>
                <th>Readiness</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {contributions.map(
                (contribution) => (
                  <tr
                    key={contribution.id}
                  >
                    <td>
                      <Link
                        className="pr-link"
                        to={`/repositories/${repositoryId}/contributions/${contribution.pullRequestNumber}`}
                      >
                        #
                        {
                          contribution.pullRequestNumber
                        }
                      </Link>
                    </td>
                    <td>
                      <span className="status-pill">
                        {stateLabel(
                          contribution.workflowState
                        )}
                      </span>
                    </td>
                    <td>
                      {stateLabel(
                        contribution.nextActor
                      )}
                    </td>
                    <td>
                      {stateLabel(
                        contribution.readiness
                      )}
                    </td>
                    <td className="reason-cell">
                      {stateLabel(
                        contribution.reasonCode
                      )}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
