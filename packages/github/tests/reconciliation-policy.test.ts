import { describe, expect, it } from "vitest";

import { derivePullRequestPolicy } from "../src/reconciliation-policy.js";

describe("derivePullRequestPolicy", () => {
  it("combines active pull request and required-check rules", () => {
    const policy = derivePullRequestPolicy([
      {
        type: "pull_request",
        parameters: {
          required_approving_review_count: 2,
          dismiss_stale_reviews_on_push: true,
          require_last_push_approval: false,
          require_code_owner_review: false,
          required_review_thread_resolution: false
        }
      },
      {
        type: "required_status_checks",
        parameters: {
          required_status_checks: [
            {
              context: "build",
              integration_id: 123
            },
            {
              context: "lint"
            }
          ]
        }
      }
    ]);

    expect(policy).toMatchObject({
      pullRequestRulePresent: true,
      requiredApprovingReviewCount: 2,
      dismissStaleReviewsOnPush: true,
      requireLastPushApproval: false
    });

    expect(policy.requiredStatusChecks).toEqual([
      {
        context: "build",
        integrationId: 123
      },
      {
        context: "lint",
        integrationId: null
      }
    ]);
  });

  it("uses the strongest requirements across multiple rules", () => {
    const policy = derivePullRequestPolicy([
      {
        type: "pull_request",
        parameters: {
          required_approving_review_count: 1
        }
      },
      {
        type: "pull_request",
        parameters: {
          required_approving_review_count: 3,
          require_code_owner_review: true
        }
      }
    ]);

    expect(policy.requiredApprovingReviewCount).toBe(3);
    expect(policy.requireCodeOwnerReview).toBe(true);
  });
});
