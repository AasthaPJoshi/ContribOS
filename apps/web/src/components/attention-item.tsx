import {
  Link
} from "react-router-dom";

import type {
  AttentionQueueItem
} from "../api/types.js";
import {
  humanizeToken
} from "../product/dashboard-view-model.js";
import {
  attentionReasonLabel,
  priorityClass
} from "../product/attention-view-model.js";

function label(
  value: string | null
): string {
  return value
    ? humanizeToken(value)
    : "Unknown";
}

export function AttentionItemCard({
  repositoryId,
  item
}: {
  repositoryId: number;
  item: AttentionQueueItem;
}) {
  return (
    <article
      className={`attention-card ${priorityClass(item)}`}
    >
      <div className="attention-card-main">
        <div className="attention-title-row">
          <Link
            className="attention-pr"
            to={`/repositories/${repositoryId}/contributions/${item.pullRequestNumber}`}
          >
            PR #{item.pullRequestNumber}
          </Link>

          <span className="priority-badge">
            {item.priorityBand}
          </span>
        </div>

        <div className="attention-meta-grid">
          <div>
            <span className="meta-label">
              Workflow
            </span>
            <strong>
              {label(item.workflowState)}
            </strong>
          </div>

          <div>
            <span className="meta-label">
              Next actor
            </span>
            <strong>
              {label(item.nextActor)}
            </strong>
          </div>

          <div>
            <span className="meta-label">
              Readiness
            </span>
            <strong>
              {label(item.readiness)}
            </strong>
          </div>

          <div>
            <span className="meta-label">
              Score
            </span>
            <strong>
              {item.priorityScore}
            </strong>
          </div>
        </div>

        <p className="attention-reasons">
          {attentionReasonLabel(
            item.priorityReasons
          )}
        </p>
      </div>

      <a
        className="secondary-link"
        href={item.url}
        target="_blank"
        rel="noreferrer"
      >
        GitHub
      </a>
    </article>
  );
}
