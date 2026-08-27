import type {
  RepositoryContributionSummary,
  RepositoryDashboard
} from "../api/types.js";

export interface DashboardMetric {
  label: string;
  value: number;
  emphasis:
    | "default"
    | "attention"
    | "success"
    | "warning";
}

export interface CountEntry {
  label: string;
  value: number;
}

export function humanizeToken(
  value: string
): string {
  return value
    .toLowerCase()
    .split("_")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1)
    )
    .join(" ");
}

export function dashboardMetrics(
  dashboard: RepositoryDashboard
): DashboardMetric[] {
  return [
    {
      label: "Active",
      value: dashboard.totals.active,
      emphasis: "default"
    },
    {
      label: "Needs maintainer",
      value:
        dashboard.totals
          .maintainerAction,
      emphasis: "attention"
    },
    {
      label: "Ready to merge",
      value:
        dashboard.totals.readyToMerge,
      emphasis: "success"
    },
    {
      label: "Blocked",
      value: dashboard.totals.blocked,
      emphasis: "warning"
    },
    {
      label: "Ambiguous",
      value:
        dashboard.totals.ambiguous,
      emphasis: "warning"
    },
    {
      label: "Ready for release",
      value:
        dashboard.totals
          .readyForRelease,
      emphasis: "success"
    }
  ];
}

export function countEntries(
  counts: Record<string, number>
): CountEntry[] {
  return Object.entries(counts)
    .filter(([, value]) => value > 0)
    .sort(
      ([leftKey, leftValue],
       [rightKey, rightValue]) =>
        rightValue - leftValue ||
        leftKey.localeCompare(rightKey)
    )
    .map(([key, value]) => ({
      label: humanizeToken(key),
      value
    }));
}

export function recentContributions(
  contributions:
    RepositoryContributionSummary[],
  limit = 8
): RepositoryContributionSummary[] {
  return [...contributions]
    .sort(
      (left, right) =>
        right.pullRequestNumber -
        left.pullRequestNumber
    )
    .slice(0, limit);
}
