# Reliability Runbook

## Health Endpoints

### Liveness

GET /health/live

Used by orchestration systems to verify process health.

### Readiness

GET /health/ready

Checks:

- PostgreSQL
- Soroban RPC + contract simulation

Returns one of three states (Issue #935 — full contract and per-component
shape documented in [`observability.md`](./observability.md#degraded-mode-readiness-contract-issue-935)):

- `ready` (`200`) — everything healthy.
- `degraded` (`200`) — still serving traffic, but a dependency is slow or the
  background event listener is in an error back-off. Investigate, don't page.
- `not_ready` (`503`) — a dependency is fully down or config is invalid.
  Unchanged from the previous binary contract.

### Startup

GET /health/startup

Checks startup completion and uptime.

---

## Rollback Procedure

1. Deploy previous image version.
2. Restart pods.
3. Verify /health/ready returns healthy.
4. Confirm database connectivity.

---

## Incident Response

If readiness returns `not_ready` (`503`):

- Check PostgreSQL availability
- Check Soroban RPC / contract simulation availability
- Inspect application logs
- Verify deployment secrets

If readiness returns `degraded` (`200`): traffic is still being served. Check
the slow/impaired component(s) in the response body, but this does not need
page-level urgency on its own — see `observability.md`.