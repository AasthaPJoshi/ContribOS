import type {
  DashboardMetric
} from "../product/dashboard-view-model.js";

export function MetricCard({
  metric
}: {
  metric: DashboardMetric;
}) {
  return (
    <article
      className={`metric-card metric-${metric.emphasis}`}
    >
      <span className="metric-label">
        {metric.label}
      </span>
      <strong className="metric-value">
        {metric.value}
      </strong>
    </article>
  );
}
