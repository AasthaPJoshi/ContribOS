import type {
  AttentionSummary
} from "../product/attention-view-model.js";

export function AttentionSummaryCards({
  summary
}: {
  summary: AttentionSummary;
}) {
  const items = [
    ["Total", summary.total],
    ["Critical", summary.critical],
    ["High", summary.high],
    ["Normal", summary.normal],
    ["Low", summary.low]
  ] as const;

  return (
    <section
      className="attention-summary-grid"
      aria-label="Attention queue summary"
    >
      {items.map(([label, value]) => (
        <article
          className="metric-card"
          key={label}
        >
          <span className="metric-label">
            {label}
          </span>
          <strong className="metric-value">
            {value}
          </strong>
        </article>
      ))}
    </section>
  );
}
