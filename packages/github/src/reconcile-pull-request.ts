import type {
  CheckStatus,
  EvidenceRef,
  ReviewDecision
} from "@contribos/domain";

import {
  GitHubApiError,
  type GitHubApiRequestOptions
} from "./github-api-client.js";
import type { GitHubPullRequestRecord } from "./pull-request-record.js";
import { toPullRequestSnapshot } from "./pull-request-record.js";
import {
  comparePullRequestSnapshots,
  decideReconciliationRepair
} from "./reconciliation-drift.js";
import {
  derivePullRequestPolicy,
  type PullRequestPolicy,
  type RequiredStatusCheck
} from "./reconciliation-policy.js";
import { getReconciliationRetryDelayMs } from "./reconciliation-retry.js";
import type {
  PullRequestReconciliationResult,
  ReconcilePullRequestInput
} from "./reconciliation-types.js";

type UnknownRecord = Record<string, unknown>;

export interface GitHubApiRequester {
  request<T>(
    installationId: number,
    path: string,
    options?: GitHubApiRequestOptions
  ): Promise<T>;
}

export interface ReconcilePullRequestOptions {
  clock?: () => Date;
  sleep?: (delayMs: number) => Promise<void>;
  mergeabilityAttempts?: number;
  maxPages?: number;
}

export class GitHubReconciliationError extends Error {
  readonly reasonCode: string;

  constructor(message: string, reasonCode: string) {
    super(message);
    this.name = "GitHubReconciliationError";
    this.reasonCode = reasonCode;
  }
}

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function requireRecord(
  value: unknown,
  reasonCode: string
): UnknownRecord {
  const record = asRecord(value);

  if (!record) {
    throw new GitHubReconciliationError(
      "GitHub returned an unexpected response shape.",
      reasonCode
    );
  }

  return record;
}

function getString(
  record: UnknownRecord | null,
  key: string
): string | null {
  const value = record?.[key];

  return typeof value === "string" && value.trim()
    ? value
    : null;
}

function getNumber(
  record: UnknownRecord | null,
  key: string
): number | null {
  const value = record?.[key];

  return typeof value === "number" && Number.isFinite(value)
    ? value
    : null;
}

function getBoolean(
  record: UnknownRecord | null,
  key: string
): boolean | null {
  const value = record?.[key];

  return typeof value === "boolean" ? value : null;
}

function getRecord(
  record: UnknownRecord | null,
  key: string
): UnknownRecord | null {
  return asRecord(record?.[key]);
}

function parseDate(value: unknown, fallback: Date): Date {
  if (typeof value === "string") {
    const parsed = new Date(value);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return fallback;
}

function requirePositiveInteger(
  value: number,
  reasonCode: string,
  fieldName: string
): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new GitHubReconciliationError(
      `${fieldName} must be a positive integer.`,
      reasonCode
    );
  }
}

function requireRepositorySegment(
  value: string,
  reasonCode: string,
  fieldName: string
): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new GitHubReconciliationError(
      `${fieldName} is required.`,
      reasonCode
    );
  }

  return encodeURIComponent(normalized);
}

interface ParsedPullRequest {
  raw: UnknownRecord;
  id: number;
  url: string;
  state: string;
  draft: boolean;
  merged: boolean;
  mergeable: boolean | null;
  headSha: string;
  baseRef: string;
}

function parsePullRequest(value: unknown): ParsedPullRequest {
  const pullRequest = requireRecord(
    value,
    "INVALID_PULL_REQUEST_RESPONSE"
  );

  const id = getNumber(pullRequest, "id");
  const url = getString(pullRequest, "html_url");
  const state = getString(pullRequest, "state");
  const draft = getBoolean(pullRequest, "draft");
  const merged = getBoolean(pullRequest, "merged");
  const mergeableRaw = pullRequest["mergeable"];
  const headSha = getString(
    getRecord(pullRequest, "head"),
    "sha"
  );
  const baseRef = getString(
    getRecord(pullRequest, "base"),
    "ref"
  );

  if (
    id === null ||
    !url ||
    !state ||
    draft === null ||
    merged === null ||
    !headSha ||
    !baseRef
  ) {
    throw new GitHubReconciliationError(
      "GitHub returned an incomplete pull request response.",
      "INVALID_PULL_REQUEST_RESPONSE"
    );
  }

  if (
    mergeableRaw !== null &&
    mergeableRaw !== undefined &&
    typeof mergeableRaw !== "boolean"
  ) {
    throw new GitHubReconciliationError(
      "GitHub returned an invalid mergeable value.",
      "INVALID_PULL_REQUEST_RESPONSE"
    );
  }

  return {
    raw: pullRequest,
    id,
    url,
    state,
    draft,
    merged,
    mergeable:
      typeof mergeableRaw === "boolean"
        ? mergeableRaw
        : null,
    headSha,
    baseRef
  };
}

function createPullRequestEvidence(
  pullRequest: ParsedPullRequest,
  fallback: Date
): EvidenceRef {
  return {
    id: `github:pull-request:${pullRequest.id}`,
    source: "GITHUB",
    objectType: "PULL_REQUEST",
    externalId: String(pullRequest.id),
    url: pullRequest.url,
    occurredAt: parseDate(
      pullRequest.raw["updated_at"] ??
        pullRequest.raw["created_at"],
      fallback
    )
  };
}

async function fetchStablePullRequest(
  client: GitHubApiRequester,
  installationId: number,
  repositoryId: number,
  pullPath: string,
  attempts: number,
  sleep: (delayMs: number) => Promise<void>
): Promise<ParsedPullRequest> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await client.request<unknown>(
      installationId,
      pullPath,
      {
        repositoryId,
        requiredPermissions: [
          {
            permission: "pull_requests",
            level: "read"
          }
        ]
      }
    );

    const pullRequest = parsePullRequest(response);

    if (
      pullRequest.merged ||
      pullRequest.state !== "open" ||
      pullRequest.mergeable !== null
    ) {
      return pullRequest;
    }

    if (attempt < attempts) {
      await sleep(getReconciliationRetryDelayMs(attempt));
    }
  }

  const finalResponse = await client.request<unknown>(
    installationId,
    pullPath,
    {
      repositoryId,
      requiredPermissions: [
        {
          permission: "pull_requests",
          level: "read"
        }
      ]
    }
  );

  return parsePullRequest(finalResponse);
}

function isUnavailableBranchRulesFeature(error: unknown): boolean {
  return (
    error instanceof GitHubApiError &&
    error.status === 403 &&
    error.githubMessage?.includes(
      "Upgrade to GitHub Pro or make this repository public"
    ) === true
  );
}

async function fetchPaginatedArray(
  client: GitHubApiRequester,
  installationId: number,
  repositoryId: number,
  path: string,
  permission: string,
  maxPages: number,
  reasonCode: string
): Promise<unknown[]> {
  const result: unknown[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const response = await client.request<unknown>(
      installationId,
      `${path}${separator}per_page=100&page=${page}`,
      {
        repositoryId,
        requiredPermissions: [
          {
            permission,
            level: "read"
          }
        ]
      }
    );

    if (!Array.isArray(response)) {
      throw new GitHubReconciliationError(
        "GitHub returned an invalid paginated array.",
        reasonCode
      );
    }

    result.push(...response);

    if (response.length < 100) {
      return result;
    }
  }

  throw new GitHubReconciliationError(
    "GitHub pagination exceeded the configured safety limit.",
    "PAGINATION_LIMIT_EXCEEDED"
  );
}

async function fetchPaginatedCheckRuns(
  client: GitHubApiRequester,
  installationId: number,
  repositoryId: number,
  path: string,
  maxPages: number
): Promise<UnknownRecord[]> {
  const result: UnknownRecord[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const response = requireRecord(
      await client.request<unknown>(
        installationId,
        `${path}?per_page=100&page=${page}`,
        {
          repositoryId,
          requiredPermissions: [
            {
              permission: "checks",
              level: "read"
            }
          ]
        }
      ),
      "INVALID_CHECK_RUNS_RESPONSE"
    );

    const checkRuns = response["check_runs"];

    if (!Array.isArray(checkRuns)) {
      throw new GitHubReconciliationError(
        "GitHub returned an invalid check-runs response.",
        "INVALID_CHECK_RUNS_RESPONSE"
      );
    }

    for (const item of checkRuns) {
      const record = asRecord(item);

      if (!record) {
        throw new GitHubReconciliationError(
          "GitHub returned an invalid check-run object.",
          "INVALID_CHECK_RUNS_RESPONSE"
        );
      }

      result.push(record);
    }

    if (checkRuns.length < 100) {
      return result;
    }
  }

  throw new GitHubReconciliationError(
    "GitHub check-run pagination exceeded the configured safety limit.",
    "PAGINATION_LIMIT_EXCEEDED"
  );
}

function decisiveReviewState(state: string): boolean {
  return (
    state === "APPROVED" ||
    state === "CHANGES_REQUESTED" ||
    state === "DISMISSED"
  );
}

function deriveReviewDecision(
  reviews: unknown[],
  policy: PullRequestPolicy,
  headSha: string
): {
  decision: ReviewDecision;
  authorHasChangesToMake: boolean;
  maintainerReviewRequired: boolean;
  policyResolved: boolean;
} {
  if (
    policy.requireLastPushApproval ||
    policy.requireCodeOwnerReview ||
    policy.requiredReviewThreadResolution
  ) {
    return {
      decision: "UNKNOWN",
      authorHasChangesToMake: false,
      maintainerReviewRequired: true,
      policyResolved: false
    };
  }

  const latestByReviewer = new Map<
    string,
    {
      state: string;
      occurredAt: number;
      id: number;
      commitId: string | null;
    }
  >();

  for (const item of reviews) {
    const review = asRecord(item);

    if (!review) {
      throw new GitHubReconciliationError(
        "GitHub returned an invalid review object.",
        "INVALID_REVIEWS_RESPONSE"
      );
    }

    const id = getNumber(review, "id");
    const state = getString(review, "state");
    const login = getString(
      getRecord(review, "user"),
      "login"
    );

    if (id === null || !state) {
      throw new GitHubReconciliationError(
        "GitHub returned an incomplete review object.",
        "INVALID_REVIEWS_RESPONSE"
      );
    }

    if (!decisiveReviewState(state)) {
      continue;
    }

    const occurredAt = parseDate(
      review["submitted_at"],
      new Date(0)
    ).getTime();

    const key = login ?? `reviewer:${id}`;
    const current = latestByReviewer.get(key);

    if (
      !current ||
      occurredAt > current.occurredAt ||
      (occurredAt === current.occurredAt && id > current.id)
    ) {
      latestByReviewer.set(key, {
        state,
        occurredAt,
        id,
        commitId: getString(review, "commit_id")
      });
    }
  }

  const currentReviews = [...latestByReviewer.values()];

  if (
    currentReviews.some(
      (review) => review.state === "CHANGES_REQUESTED"
    )
  ) {
    return {
      decision: "CHANGES_REQUESTED",
      authorHasChangesToMake: true,
      maintainerReviewRequired: false,
      policyResolved: true
    };
  }

  let approvals = currentReviews.filter(
    (review) => review.state === "APPROVED"
  );

  if (policy.dismissStaleReviewsOnPush) {
    approvals = approvals.filter(
      (review) => review.commitId === headSha
    );
  }

  const requiredApprovals = policy.pullRequestRulePresent
    ? policy.requiredApprovingReviewCount
    : 0;

  if (approvals.length >= requiredApprovals) {
    return {
      decision: "APPROVED",
      authorHasChangesToMake: false,
      maintainerReviewRequired: false,
      policyResolved: true
    };
  }

  return {
    decision: "REVIEW_REQUIRED",
    authorHasChangesToMake: false,
    maintainerReviewRequired: true,
    policyResolved: true
  };
}

function successfulCheckConclusion(
  conclusion: string
): boolean {
  return (
    conclusion === "success" ||
    conclusion === "neutral" ||
    conclusion === "skipped"
  );
}

function parseLatestStatuses(
  statusItems: unknown[]
): Map<string, string> {
  const latest = new Map<
    string,
    { state: string; time: number; id: number }
  >();

  for (const item of statusItems) {
    const status = asRecord(item);

    if (!status) {
      throw new GitHubReconciliationError(
        "GitHub returned an invalid commit-status object.",
        "INVALID_COMMIT_STATUS_RESPONSE"
      );
    }

    const context = getString(status, "context");
    const state = getString(status, "state");
    const id = getNumber(status, "id") ?? 0;

    if (!context || !state) {
      throw new GitHubReconciliationError(
        "GitHub returned an incomplete commit-status object.",
        "INVALID_COMMIT_STATUS_RESPONSE"
      );
    }

    const time = parseDate(
      status["updated_at"] ?? status["created_at"],
      new Date(0)
    ).getTime();

    const current = latest.get(context);

    if (
      !current ||
      time > current.time ||
      (time === current.time && id > current.id)
    ) {
      latest.set(context, {
        state,
        time,
        id
      });
    }
  }

  return new Map(
    [...latest.entries()].map(([context, value]) => [
      context,
      value.state
    ])
  );
}

function matchRequiredCheckRun(
  checkRuns: UnknownRecord[],
  required: RequiredStatusCheck
): UnknownRecord | null {
  for (const checkRun of checkRuns) {
    if (getString(checkRun, "name") !== required.context) {
      continue;
    }

    if (required.integrationId === null) {
      return checkRun;
    }

    const appId = getNumber(
      getRecord(checkRun, "app"),
      "id"
    );

    if (appId === required.integrationId) {
      return checkRun;
    }
  }

  return null;
}

function requiredCheckState(
  checkRuns: UnknownRecord[],
  statuses: Map<string, string>,
  required: RequiredStatusCheck
): CheckStatus {
  const checkRun = matchRequiredCheckRun(
    checkRuns,
    required
  );

  if (checkRun) {
    const status = getString(checkRun, "status");

    if (!status) {
      return "UNKNOWN";
    }

    if (status !== "completed") {
      return "PENDING";
    }

    const conclusion = getString(
      checkRun,
      "conclusion"
    );

    if (!conclusion) {
      return "UNKNOWN";
    }

    return successfulCheckConclusion(conclusion)
      ? "SUCCESS"
      : "FAILURE";
  }

  if (required.integrationId !== null) {
    return "PENDING";
  }

  const legacyState = statuses.get(required.context);

  if (!legacyState || legacyState === "pending") {
    return "PENDING";
  }

  return legacyState === "success"
    ? "SUCCESS"
    : "FAILURE";
}

function deriveCheckStatus(
  checkRuns: UnknownRecord[],
  statusItems: unknown[],
  requiredChecks: RequiredStatusCheck[],
  policyAvailability: PullRequestPolicy["policyAvailability"]
): CheckStatus {
  const statuses = parseLatestStatuses(statusItems);

  if (requiredChecks.length > 0) {
    let sawPending = false;
    let sawUnknown = false;

    for (const required of requiredChecks) {
      const state = requiredCheckState(
        checkRuns,
        statuses,
        required
      );

      if (state === "FAILURE") {
        return "FAILURE";
      }

      if (state === "PENDING") {
        sawPending = true;
      }

      if (state === "UNKNOWN") {
        sawUnknown = true;
      }
    }

    if (sawPending) {
      return "PENDING";
    }

    if (sawUnknown) {
      return "UNKNOWN";
    }

    return "SUCCESS";
  }

  if (checkRuns.length === 0 && statuses.size === 0) {
    return policyAvailability === "AVAILABLE"
      ? "NOT_REQUIRED"
      : "UNKNOWN";
  }

  let sawPending = false;
  let sawUnknown = false;

  for (const checkRun of checkRuns) {
    const status = getString(checkRun, "status");

    if (!status) {
      sawUnknown = true;
      continue;
    }

    if (status !== "completed") {
      sawPending = true;
      continue;
    }

    const conclusion = getString(
      checkRun,
      "conclusion"
    );

    if (!conclusion) {
      sawUnknown = true;
      continue;
    }

    if (!successfulCheckConclusion(conclusion)) {
      return "FAILURE";
    }
  }

  for (const state of statuses.values()) {
    if (state === "failure" || state === "error") {
      return "FAILURE";
    }

    if (state === "pending") {
      sawPending = true;
    }
  }

  if (sawPending) {
    return "PENDING";
  }

  if (sawUnknown) {
    return "UNKNOWN";
  }

  return "SUCCESS";
}

function createReviewEvidence(
  reviews: unknown[],
  fallbackUrl: string,
  fallback: Date
): EvidenceRef[] {
  const evidence: EvidenceRef[] = [];

  for (const item of reviews) {
    const review = asRecord(item);
    const id = getNumber(review, "id");

    if (!review || id === null) {
      continue;
    }

    evidence.push({
      id: `github:review:${id}`,
      source: "GITHUB",
      objectType: "REVIEW",
      externalId: String(id),
      url: getString(review, "html_url") ?? fallbackUrl,
      occurredAt: parseDate(
        review["submitted_at"],
        fallback
      )
    });
  }

  return evidence;
}

function createCheckRunEvidence(
  checkRuns: UnknownRecord[],
  fallbackUrl: string,
  fallback: Date
): EvidenceRef[] {
  return checkRuns.flatMap((checkRun) => {
    const id = getNumber(checkRun, "id");

    if (id === null) {
      return [];
    }

    return [
      {
        id: `github:check-run:${id}`,
        source: "GITHUB" as const,
        objectType: "CHECK_RUN" as const,
        externalId: String(id),
        url:
          getString(checkRun, "html_url") ??
          fallbackUrl,
        occurredAt: parseDate(
          checkRun["completed_at"] ??
            checkRun["started_at"],
          fallback
        )
      }
    ];
  });
}

function createCommitStatusEvidence(
  statuses: unknown[],
  headSha: string,
  fallbackUrl: string,
  fallback: Date
): EvidenceRef[] {
  return statuses.flatMap((item) => {
    const status = asRecord(item);
    const id = getNumber(status, "id");
    const context = getString(status, "context");

    if (!status || id === null || !context) {
      return [];
    }

    return [
      {
        id: `github:commit-status:${id}`,
        source: "GITHUB" as const,
        objectType: "COMMIT" as const,
        externalId: `${headSha}:${context}`,
        url:
          getString(status, "target_url") ??
          fallbackUrl,
        occurredAt: parseDate(
          status["updated_at"] ??
            status["created_at"],
          fallback
        )
      }
    ];
  });
}

export async function reconcilePullRequest(
  client: GitHubApiRequester,
  input: ReconcilePullRequestInput,
  options: ReconcilePullRequestOptions = {}
): Promise<PullRequestReconciliationResult> {
  requirePositiveInteger(
    input.installationId,
    "INVALID_INSTALLATION_ID",
    "installationId"
  );
  requirePositiveInteger(
    input.repositoryId,
    "INVALID_REPOSITORY_ID",
    "repositoryId"
  );
  requirePositiveInteger(
    input.pullRequestNumber,
    "INVALID_PULL_REQUEST_NUMBER",
    "pullRequestNumber"
  );

  const owner = requireRepositorySegment(
    input.owner,
    "INVALID_REPOSITORY_OWNER",
    "owner"
  );
  const repository = requireRepositorySegment(
    input.repository,
    "INVALID_REPOSITORY_NAME",
    "repository"
  );

  const clock = options.clock ?? (() => new Date());
  const sleep =
    options.sleep ??
    (async (delayMs: number) => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, delayMs);
      });
    });

  const attempts = options.mergeabilityAttempts ?? 3;
  const maxPages = options.maxPages ?? 10;

  if (!Number.isSafeInteger(attempts) || attempts < 1) {
    throw new GitHubReconciliationError(
      "mergeabilityAttempts must be at least 1.",
      "INVALID_RECONCILIATION_OPTIONS"
    );
  }

  if (!Number.isSafeInteger(maxPages) || maxPages < 1) {
    throw new GitHubReconciliationError(
      "maxPages must be at least 1.",
      "INVALID_RECONCILIATION_OPTIONS"
    );
  }

  const basePath = `/repos/${owner}/${repository}`;
  const pullPath =
    `${basePath}/pulls/${input.pullRequestNumber}`;

  const initialPullRequest =
    await fetchStablePullRequest(
      client,
      input.installationId,
      input.repositoryId,
      pullPath,
      attempts,
      sleep
    );

  const reconciledAt = clock();

  if (
    initialPullRequest.state === "open" &&
    !initialPullRequest.merged &&
    initialPullRequest.mergeable === null
  ) {
    return {
      status: "RETRY_REQUIRED",
      reasonCode: "MERGEABILITY_PENDING",
      record: null,
      snapshot: null,
      evidence: [
        createPullRequestEvidence(
          initialPullRequest,
          reconciledAt
        )
      ],
      headSha: initialPullRequest.headSha,
      reconciledAt,
      policy: null,
      drift: null,
      repairDecision: {
        action: "DEFER",
        reasonCode: "RECONCILIATION_NOT_STABLE"
      }
    };
  }

  const rulesPath =
    `${basePath}/rules/branches/` +
    `${encodeURIComponent(initialPullRequest.baseRef)}`;

  const reviewsPath = `${pullPath}/reviews`;
  const checkRunsPath =
    `${basePath}/commits/` +
    `${encodeURIComponent(initialPullRequest.headSha)}` +
    `/check-runs`;
  const statusesPath =
    `${basePath}/commits/` +
    `${encodeURIComponent(initialPullRequest.headSha)}` +
    `/statuses`;

  const rulesPromise = fetchPaginatedArray(
    client,
    input.installationId,
    input.repositoryId,
    rulesPath,
    "metadata",
    maxPages,
    "INVALID_RULES_RESPONSE"
  )
    .then((rules) => ({
      availability: "AVAILABLE" as const,
      rules
    }))
    .catch((error: unknown) => {
      if (isUnavailableBranchRulesFeature(error)) {
        return {
          availability: "UNAVAILABLE" as const,
          rules: []
        };
      }

      throw error;
    });

  const [
    rulesResult,
    reviews,
    checkRuns,
    statuses
  ] = await Promise.all([
    rulesPromise,
    fetchPaginatedArray(
      client,
      input.installationId,
      input.repositoryId,
      reviewsPath,
      "pull_requests",
      maxPages,
      "INVALID_REVIEWS_RESPONSE"
    ),
    fetchPaginatedCheckRuns(
      client,
      input.installationId,
      input.repositoryId,
      checkRunsPath,
      maxPages
    ),
    fetchPaginatedArray(
      client,
      input.installationId,
      input.repositoryId,
      statusesPath,
      "statuses",
      maxPages,
      "INVALID_COMMIT_STATUS_RESPONSE"
    )
  ]);

  let policy: PullRequestPolicy;

  try {
    policy = derivePullRequestPolicy(rulesResult.rules);

    if (rulesResult.availability === "UNAVAILABLE") {
      policy = {
        ...policy,
        policyAvailability: "UNAVAILABLE"
      };
    }
  } catch {
    throw new GitHubReconciliationError(
      "GitHub returned an invalid branch rules response.",
      "INVALID_RULES_RESPONSE"
    );
  }

  const reviewState = deriveReviewDecision(
    reviews,
    policy,
    initialPullRequest.headSha
  );

  const checkStatus = deriveCheckStatus(
    checkRuns,
    statuses,
    policy.requiredStatusChecks,
    policy.policyAvailability
  );

  const finalPullRequest = parsePullRequest(
    await client.request<unknown>(
      input.installationId,
      pullPath,
      {
        repositoryId: input.repositoryId,
        requiredPermissions: [
          {
            permission: "pull_requests",
            level: "read"
          }
        ]
      }
    )
  );

  if (
    finalPullRequest.headSha !==
    initialPullRequest.headSha
  ) {
    return {
      status: "RETRY_REQUIRED",
      reasonCode: "HEAD_SHA_CHANGED",
      record: null,
      snapshot: null,
      evidence: [
        createPullRequestEvidence(
          finalPullRequest,
          reconciledAt
        )
      ],
      headSha: finalPullRequest.headSha,
      reconciledAt,
      policy,
      drift: null,
      repairDecision: {
        action: "DEFER",
        reasonCode: "RECONCILIATION_NOT_STABLE"
      }
    };
  }

  const record: GitHubPullRequestRecord = {
    repositoryId: String(input.repositoryId),
    pullRequestNumber: input.pullRequestNumber,
    pullRequestId: String(finalPullRequest.id),
    url: finalPullRequest.url,
    headSha: finalPullRequest.headSha,
    isDraft: finalPullRequest.draft,
    isOpen: finalPullRequest.state === "open",
    isMerged: finalPullRequest.merged,
    hasMergeConflict:
      finalPullRequest.mergeable === false,
    checkStatus,
    reviewDecision: reviewState.decision,
    authorHasChangesToMake:
      reviewState.authorHasChangesToMake,
    maintainerReviewRequired:
      reviewState.maintainerReviewRequired
  };

  const evidence: EvidenceRef[] = [
    createPullRequestEvidence(
      finalPullRequest,
      reconciledAt
    ),
    ...createReviewEvidence(
      reviews,
      finalPullRequest.url,
      reconciledAt
    ),
    ...createCheckRunEvidence(
      checkRuns,
      finalPullRequest.url,
      reconciledAt
    ),
    ...createCommitStatusEvidence(
      statuses,
      finalPullRequest.headSha,
      finalPullRequest.url,
      reconciledAt
    )
  ];

  const snapshot = {
    ...toPullRequestSnapshot(record),
    evidence
  };

  const policyResolved = reviewState.policyResolved;

  const status = policyResolved
    ? "READY"
    : "POLICY_UNRESOLVED";

  const reasonCode = policyResolved
    ? "RECONCILIATION_READY"
    : "REVIEW_POLICY_REQUIRES_ADDITIONAL_EVIDENCE";

  const observed =
    input.observedSnapshot ?? null;

  const drift = observed
    ? comparePullRequestSnapshots(
        observed,
        snapshot
      )
    : null;

  return {
    status,
    reasonCode,
    record,
    snapshot,
    evidence,
    headSha: finalPullRequest.headSha,
    reconciledAt,
    policy,
    drift,
    repairDecision:
      decideReconciliationRepair(
        observed,
        snapshot,
        policyResolved
      )
  };
}
