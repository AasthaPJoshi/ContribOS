import { randomUUID } from "node:crypto";

const REQUEST_ID_PATTERN =
  /^[A-Za-z0-9._:-]{1,128}$/;

export interface RequestMetricsSnapshot {
  totalRequests: number;
  activeRequests: number;
  failedRequests: number;
}

export function resolveRequestId(
  candidate: string | undefined
): string {
  const normalized = candidate?.trim();

  if (
    normalized &&
    REQUEST_ID_PATTERN.test(normalized)
  ) {
    return normalized;
  }

  return randomUUID();
}

export class RequestMetrics {
  private totalRequests = 0;
  private activeRequests = 0;
  private failedRequests = 0;

  begin(): void {
    this.totalRequests += 1;
    this.activeRequests += 1;
  }

  finish(statusCode: number): void {
    this.activeRequests = Math.max(
      0,
      this.activeRequests - 1
    );

    if (statusCode >= 500) {
      this.failedRequests += 1;
    }
  }

  snapshot(): RequestMetricsSnapshot {
    return {
      totalRequests: this.totalRequests,
      activeRequests: this.activeRequests,
      failedRequests: this.failedRequests
    };
  }
}
