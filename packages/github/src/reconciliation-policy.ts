type UnknownRecord = Record<string, unknown>;

export interface RequiredStatusCheck {
  context: string;
  integrationId: number | null;
}

export type PolicyAvailability =
  | "AVAILABLE"
  | "UNAVAILABLE";

export interface PullRequestPolicy {
  policyAvailability: PolicyAvailability;
  pullRequestRulePresent: boolean;
  requiredApprovingReviewCount: number;
  dismissStaleReviewsOnPush: boolean;
  requireLastPushApproval: boolean;
  requireCodeOwnerReview: boolean;
  requiredReviewThreadResolution: boolean;
  requiredStatusChecks: RequiredStatusCheck[];
}

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function getBoolean(
  record: UnknownRecord | null,
  key: string
): boolean {
  return record?.[key] === true;
}

function getNonNegativeInteger(
  record: UnknownRecord | null,
  key: string
): number {
  const value = record?.[key];

  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : 0;
}

export function derivePullRequestPolicy(
  rulesResponse: unknown
): PullRequestPolicy {
  if (!Array.isArray(rulesResponse)) {
    throw new Error("INVALID_RULES_RESPONSE");
  }

  const requiredStatusChecks = new Map<string, RequiredStatusCheck>();

  let pullRequestRulePresent = false;
  let requiredApprovingReviewCount = 0;
  let dismissStaleReviewsOnPush = false;
  let requireLastPushApproval = false;
  let requireCodeOwnerReview = false;
  let requiredReviewThreadResolution = false;

  for (const item of rulesResponse) {
    const rule = asRecord(item);

    if (!rule) {
      throw new Error("INVALID_RULES_RESPONSE");
    }

    const type = rule["type"];
    const parameters = asRecord(rule["parameters"]);

    if (type === "pull_request") {
      pullRequestRulePresent = true;

      requiredApprovingReviewCount = Math.max(
        requiredApprovingReviewCount,
        getNonNegativeInteger(
          parameters,
          "required_approving_review_count"
        )
      );

      dismissStaleReviewsOnPush =
        dismissStaleReviewsOnPush ||
        getBoolean(parameters, "dismiss_stale_reviews_on_push");

      requireLastPushApproval =
        requireLastPushApproval ||
        getBoolean(parameters, "require_last_push_approval");

      requireCodeOwnerReview =
        requireCodeOwnerReview ||
        getBoolean(parameters, "require_code_owner_review");

      requiredReviewThreadResolution =
        requiredReviewThreadResolution ||
        getBoolean(
          parameters,
          "required_review_thread_resolution"
        );
    }

    if (type === "required_status_checks") {
      const requiredChecks = parameters?.["required_status_checks"];

      if (!Array.isArray(requiredChecks)) {
        throw new Error("INVALID_RULES_RESPONSE");
      }

      for (const requiredCheck of requiredChecks) {
        const check = asRecord(requiredCheck);
        const context = check?.["context"];
        const integrationIdRaw = check?.["integration_id"];

        if (typeof context !== "string" || !context.trim()) {
          throw new Error("INVALID_RULES_RESPONSE");
        }

        const integrationId =
          typeof integrationIdRaw === "number" &&
          Number.isSafeInteger(integrationIdRaw) &&
          integrationIdRaw > 0
            ? integrationIdRaw
            : null;

        const key = `${context}:${integrationId ?? "*"}`;

        requiredStatusChecks.set(key, {
          context,
          integrationId
        });
      }
    }
  }

  return {
    policyAvailability: "AVAILABLE",
    pullRequestRulePresent,
    requiredApprovingReviewCount,
    dismissStaleReviewsOnPush,
    requireLastPushApproval,
    requireCodeOwnerReview,
    requiredReviewThreadResolution,
    requiredStatusChecks: [...requiredStatusChecks.values()]
  };
}
