# Incident Response Runbook

## First five minutes

1. determine whether `/live` responds
2. determine whether `/ready` returns 200 or 503
3. inspect structured logs using `requestId`, event name, and timestamps
4. determine whether the failure is HTTP, PostgreSQL, GitHub API, webhook, worker, or reconciliation related
5. stop rollout or remove unhealthy instances from traffic when necessary

Do not change deterministic contribution state manually merely to make the UI look healthy.

## Process alive, readiness failing

If `/live` is healthy but `/ready` is 503:

- inspect the readiness `checks`
- verify PostgreSQL connectivity
- inspect database saturation and connection limits
- verify credentials/network/DNS
- keep the instance out of normal traffic until readiness returns

## Webhook failures

Use the GitHub delivery ID as the primary correlation identifier.

Check:

- signature rejection
- unsupported event/action
- delivery retryability
- duplicate delivery handling
- enqueue failure
- stale claimed-delivery recovery

Do not replay a webhook blindly if the delivery has already been processed.

## Worker/reconciliation failures

Inspect:

- worker job error code/message
- retry count
- repository registration
- GitHub installation access
- GitHub API response class
- branch-policy availability
- reconciliation reason code

ContribOS intentionally prefers `UNKNOWN`/`AMBIGUOUS` over fabricating readiness when GitHub evidence is unavailable.

## OAuth/session failures

Check:

- public base URL and callback URL
- HTTPS/cookie behavior
- OAuth client configuration
- access-token expiry
- refresh-token availability
- repository installation access

Do not log or paste access tokens, refresh tokens, client secrets, private keys, webhook secrets, or encryption keys.

## Request correlation

HTTP responses include `x-request-id`.

Structured request completion logs contain:

- request ID
- method
- sanitized path
- status code
- duration
- in-process request counters

Use request IDs to correlate client-visible failures with server logs.
