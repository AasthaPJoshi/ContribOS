import type {
  ContributionStateSummary
} from "../product/contribution-view-model.js";

export function CurrentStatePanel({
  state
}: {
  state: ContributionStateSummary;
}) {
  return (
    <section className="panel state-overview-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">
            CURRENT STATE
          </p>
          <h3>Next move</h3>
        </div>
      </div>

      <div className="state-grid">
        <div>
          <span className="meta-label">
            Workflow
          </span>
          <strong>
            {state.workflowState}
          </strong>
        </div>

        <div>
          <span className="meta-label">
            Next actor
          </span>
          <strong>
            {state.nextActor}
          </strong>
        </div>

        <div>
          <span className="meta-label">
            Readiness
          </span>
          <strong>
            {state.readiness}
          </strong>
        </div>

        <div>
          <span className="meta-label">
            Reason
          </span>
          <strong>
            {state.reasonCode}
          </strong>
        </div>
      </div>

      <p className="state-explanation">
        {state.explanation}
      </p>
    </section>
  );
}
