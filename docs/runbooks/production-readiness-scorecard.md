# Production Readiness Scorecard

**Purpose**: Give launch reviewers a concise, single-page summary of contract,
backend, frontend, infra, security, and support readiness before a
production/mainnet release.  
**Owner**: Release lead for the launch in question  
**Last Updated**: 2026-07-25  
**Status**: TEMPLATE (copy into a launch-specific doc or PR description per release)

---

## How to use this scorecard

1. Copy the table below into the release's tracking issue or PR description.
2. Fill in **Pass/Risk**, **Owner**, and **Evidence** for every row before the
   launch review meeting — do not leave a row blank.
3. Every row needs a **Sign-off** initials/handle before the release is
   approved. A `Risk` row may still ship if the risk is explicitly accepted
   and noted in Evidence (e.g. "Known issue #XXX, mitigated by Y").
4. This scorecard summarizes; it does not replace the detailed runbooks and
   checklists it links to. When in doubt, follow the linked document.

## Scorecard

| Area | Check | Pass / Risk | Owner | Evidence | Sign-off |
|------|-------|:---:|-------|----------|:---:|
| Contract | Contract test suite, WASM build, and audit checks green ([Release readiness checklist](../release-readiness-checklist.md)) | | Contracts team | | |
| Contract | Authorization boundaries covered by tests (owner/admin/collaborator-gated ops) — `cargo test` in `contracts/` | | Contracts team | | |
| Contract | Testnet smoke test passes ([`smoke-testnet.yml`](../../.github/workflows/smoke-testnet.yml) / `scripts/smoke-testnet.mjs`) | | Contracts team | | |
| Backend | `ci.yml` backend job green (lint, build, `test:compat`, `test`) on the release commit | | Backend team | | |
| Backend | `/health/ready` and `/health/live` return healthy against the target environment | | Backend team | | |
| Backend | Graceful shutdown verified — readiness flips before shutdown completes, DB/SSE resources close within `SHUTDOWN_FORCE_TIMEOUT_MS` ([`RELIABILITY.md`](../../backend/RELIABILITY.md#graceful-shutdown-issue-868)) | | Backend team | | |
| Backend | Post-deploy smoke check passes (`scripts/deploy-smoke-check.mjs`) | | Backend team | | |
| Frontend | `frontend-ci.yml` / `frontend-quality.yml` green on the release commit | | Frontend team | | |
| Frontend | i18n key parity check passes; no untranslated/missing keys | | Frontend team | | |
| Infra | `mainnet-readiness-gate` / `GET /ops/mainnet-readiness` all four checks `pass` ([Mainnet launch runbook](./mainnet-launch.md#validation)) | | DevOps/Infra team | | |
| Infra | Required deploy secrets present (`MAINNET_CONTRACT_ID`, `RENDER_BACKEND_DEPLOY_HOOK_URL`, etc.) | | DevOps/Infra team | | |
| Security | `codeql-analysis.yml` and `dependency-audit.yml` show no unresolved high/critical findings | | Security reviewer | | |
| Security | `security-audit` job (npm audit, backend + frontend) clean or exceptions documented | | Security reviewer | | |
| Support | Rollback readiness confirmed (see below) | | Support/Ops team | | |
| Support | Monitoring & alerting confirmed live for the release (see below) | | Support/Ops team | | |

## Required CI runs

Link the specific run for each before sign-off — do not check a box from a
stale or unrelated run:

- [ ] [`ci.yml`](../../.github/workflows/ci.yml) — data integrity, frontend, backend, security-audit, contracts jobs, all green on the release commit.
- [ ] [`codeql-analysis.yml`](../../.github/workflows/codeql-analysis.yml) — no unresolved high/critical alerts.
- [ ] [`dependency-audit.yml`](../../.github/workflows/dependency-audit.yml) — no unresolved high/critical CVEs.
- [ ] [`mainnet-deploy.yml`](../../.github/workflows/mainnet-deploy.yml) (production releases only) — full gate sequence (`validate-mainnet-config` → `verify-backend-mainnet` → `mainnet-readiness-gate` → `deploy-mainnet` → `post-deploy-smoke`) green.
- [ ] [`smoke-testnet.yml`](../../.github/workflows/smoke-testnet.yml) (contract changes only) — contract lifecycle smoke test passes against the deployed contract ID.

## Smoke tests

- [ ] `scripts/deploy-smoke-check.mjs` — polls `GET /health/ready` (and `/metrics` if `CHECK_METRICS=true`) against the deployed backend until healthy or timeout. See [Observability runbook](./observability.md).
- [ ] `scripts/smoke-testnet.mjs` — exercises `create_project` → `deposit` → `distribute` end-to-end and asserts collaborator payouts match the configured split. See [Contract release & upgrade runbook](../contract-release-and-upgrade-runbook.md).

## Rollback readiness

Confirm — do not re-describe — the following are current and executable for
this release:

- [ ] [Rollback guide](../../runbooks/rollback-guide.md) — backend service, database, and smart-contract rollback procedures reviewed for anything this release changes.
- [ ] [Ops deployment & rollback runbook](./ops-deployment-rollback.md) — fast/contract-emergency/full-revert paths still match the current deploy topology.
- [ ] [Mainnet launch runbook — Rollback](./mainnet-launch.md#rollback) (production releases only).
- [ ] Last known-good deploy identified and reachable in the Render dashboard before triggering this release.

## Monitoring checks

- [ ] [Observability runbook](./observability.md) — health endpoints and `/metrics` series reviewed; nothing new added by this release is unmonitored.
- [ ] [Mainnet launch runbook — Monitoring After Launch](./mainnet-launch.md#monitoring-after-launch) (production releases only).
- [ ] Sentry (`SENTRY_DSN`) configured and receiving events for the target environment ([backend-deploy.md](../backend-deploy.md)).
- [ ] Structured JSON logs (`winston`) confirmed flowing for the target environment.

---

## Sign-Off

- [ ] Contracts Team
- [ ] Backend Team
- [ ] Frontend Team
- [ ] DevOps/Infra Team
- [ ] Security Reviewer
- [ ] Release Lead

**Date Approved**: ___________

## Related

- [Release readiness checklist](../release-readiness-checklist.md)
- [Mainnet launch runbook](./mainnet-launch.md)
- [Rollback guide](../../runbooks/rollback-guide.md)
- [Observability runbook](./observability.md)
- [Contract release & upgrade runbook](../contract-release-and-upgrade-runbook.md)
