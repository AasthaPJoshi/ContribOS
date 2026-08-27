import type {
  AttentionQueueItem,
  AttentionQueuePage
} from "../api/types.js";

export interface AttentionSummary {
  total: number;
  critical: number;
  high: number;
  normal: number;
  low: number;
}

export function summarizeAttention(
  page: AttentionQueuePage
): AttentionSummary {
  const summary: AttentionSummary = {
    total: page.total,
    critical: 0,
    high: 0,
    normal: 0,
    low: 0
  };

  for (const item of page.items) {
    if (item.priorityBand === "CRITICAL") {
      summary.critical += 1;
    } else if (item.priorityBand === "HIGH") {
      summary.high += 1;
    } else if (item.priorityBand === "NORMAL") {
      summary.normal += 1;
    } else {
      summary.low += 1;
    }
  }

  return summary;
}

export function attentionReasonLabel(
  reasons: string[]
): string {
  if (reasons.length === 0) {
    return "No priority reason recorded";
  }

  return reasons
    .map((reason) =>
      reason
        .toLowerCase()
        .split("_")
        .map(
          (part) =>
            part.charAt(0).toUpperCase() +
            part.slice(1)
        )
        .join(" ")
    )
    .join(", ");
}

export function priorityClass(
  item: Pick<
    AttentionQueueItem,
    "priorityBand"
  >
): string {
  return `priority-${item.priorityBand.toLowerCase()}`;
}
