# Observability Runbook

Operational guidance for metrics, health probes, correlation IDs, and deploy verification.

## Health Endpoints

| Endpoint | Purpose | Expected |
|----------|---------|----------|
| `GET /health` | Basic status + uptime | `200`, `{ status: "ok" }` |
| `GET /health/live` | Liveness (process up) | `200`, `{ status: "ok" }` |
| `GET /health/startup` | Initialisation complete | `200` after DB/listeners start; `503` during boot |
| `GET /health/ready` | Ready for traffic | `200` when DB + Soroban RPC + contract sim OK |

Configure Render/orchestrator probes:

- **Liveness:** `/health/live`
- **Readiness:** `/health/ready`
- **Startup (optional):** `/health/startup`

## Metrics

`GET /metrics` — Prometheus text exposition (enabled when `METRICS_ENABLED=true`, default on in production).

For the complete inventory of every metric, owner, alert threshold, and missing metrics, see [Metrics Inventory](../metrics-inventory.md).

Exposed series:

- `splitnaira_validation_failures_total` — response schema validation failures
- `splitnaira_http_requests_total{method,route,status}` — total HTTP requests by route and status
- `splitnaira_http_request_duration_seconds_sum{method,route}` — cumulative request latency in seconds
- `splitnaira_http_request_duration_seconds_count{method,route}` — number of latency samples per route
- `splitnaira_http_requests_inflight` — current in-flight HTTP requests
- `splitnaira_process_uptime_seconds`
- `splitnaira_process_heap_bytes`
- `splitnaira_info{version="..."}`
- `projects_created_total` — total projects created
- `distributions_executed_total` — total distributions executed
- `deposits_received_total` — total deposits received
- `sse_connections_active` — active SSE connections
- `splitnaira_rpc_retry_attempts_total` — total RPC retry attempts (Issue #836)
- `splitnaira_rpc_retry_max_attempts_reached_total` — times the retry budget was fully consumed without success (Issue #836)
- `splitnaira_rpc_retry_duration_ms_total` — cumulative sleeper delay between RPC retry attempts in milliseconds (Issue #836)
- `splitnaira_rpc_retry_outcomes_total{operation,outcome,endpoint}` — final outcome of RPC retry sequences labelled by operation and endpoint (Issue #836)

Contract-level telemetry is also available through on-chain event topics emitted by the SplitNaira contract. Analytics consumers should combine backend metrics with contract event streams for richer Insights.

Scrape from internal network only; do not expose publicly without auth.

## Correlation IDs

Every request receives `x-request-id` and `x-correlation-id` (same value). Clients may send either header; the value is echoed in responses and included in error payloads as `requestId`.

Structured logs (Winston JSON when `LOG_FORMAT=json`) include `requestId` on error paths.

## Post-Deploy Smoke Check

After Render deploy, CI runs `scripts/deploy-smoke-check.mjs` when repo variable `BACKEND_SMOKE_URL` is set:

```bash
BACKEND_URL=https://your-api.example.com node scripts/deploy-smoke-check.mjs
```

Polls `/health/ready` every 10s for up to 5 minutes.

When `BACKEND_METRICS_URL` is also configured, the smoke check validates the analytics/metrics exposition endpoint after readiness succeeds. This ensures the deployment is not only live, but also emitting the telemetry needed for Analytics & Insights.

## Incident Investigation

1. Obtain `x-correlation-id` / `requestId` from the client or error response.
2. Search Render logs or Sentry (when `SENTRY_DSN` is configured).
3. Check `/health/ready` component breakdown for dependency failures.
4. Review metrics around the failure window (`splitnaira_validation_failures_total` spikes indicate schema drift).

## Rollback

| Change | Rollback |
|--------|----------|
| Metrics endpoint | Set `METRICS_ENABLED=false` and redeploy |
| Smoke check failures | Roll back Render deploy; smoke check does not auto-rollback |
| Correlation header change | Revert middleware commit; clients using either header remain compatible |

## RPC Retry Observability (Issue #836)

Every call into `executeWithRetry` carries two labels: `operation` (e.g.
`simulateTransaction`, `getEvents`) and `endpoint` (e.g. `rpc`). The helper
emits the following structured logs (`LOG_FORMAT=json` recommended for
ingestion):

| Log | Level | When |
|-----|-------|------|
| `RPC retry scheduled` | warn | Each retryable failure before the next attempt |
| `RPC operation rejected before retrying` | warn | `RequestValidationError` short-circuits the helper |
| `RPC retries exhausted` | error | Final attempt failed after the full retry budget |

Log fields (stable schema):

| Field | Type | Meaning |
|-------|------|---------|
| `operation` | string | Short label identifying the RPC call (`simulateTransaction`, `getEvents`, ...) |
| `endpoint` | string | Host label, defaults to `rpc` |
| `attempt` | number | 1-based attempt number for this log line |
| `nextAttempt` | number | The attempt number that will run after the scheduled backoff (omitted for terminal lines) |
| `maxRetries` | number | The configured retry budget for the call |
| `delayMs` | number | The backoff that will be slept before the next attempt |
| `errorKind` | string | The `name` of the captured error class |
| `errorMessage` | string | Sanitized first-line of the error message (no XDR, no `secret_key=...`, no stack) |

### Alert signals

Recommended Prometheus alerts:

| Signal | Expression | Rationale |
|--------|-----------|-----------|
| Retry budget exhausted for any operation | `rate(splitnaira_rpc_retry_max_attempts_reached_total[5m]) > 0` | Burning the full budget means callers will start seeing 502/504 responses |
| Sustained `simulateTransaction` timeouts | `sum by (endpoint) (rate(splitnaira_rpc_retry_outcomes_total{outcome="timeout"}[5m])) > 0.1` | Simulation latency past `timeoutMs` means RPC is degraded for write paths |
| Cumulative retry sleep growing without success | `increase(splitnaira_rpc_retry_duration_ms_total[15m]) > 60000` | Backoffs are stacking, suggesting the RPC is flapping |
| Validation rejections from RPC | `sum by (operation) (rate(splitnaira_rpc_retry_outcomes_total{outcome="validation_error"}[5m])) > 0` | Indicates a client is sending payloads the RPC refuses — usually a contract arg drift |

### Secret-hygiene guarantees

`executeWithRetry` does not log full `Error` objects; it logs only
`errorKind` and the first line of `errorMessage`. The helper additionally
scrubs `secret_key` and `xdr=` substrings from the message before logging.
Reviewers should reject any PR that introduces `console.log(error)` or
`logger.warn({ error })` in retry paths, because those bypass the sanitizer.

## Related

- [CI/CD reliability](../cicd-reliability.md)
- [Backend deploy](../backend-deploy.md)
- [Ops deployment & rollback](./ops-deployment-rollback.md)
- [Metrics inventory](../metrics-inventory.md)
