# CI/CD Security Runbook

Operational guidance for supply-chain alerts, leaked secrets, and pipeline incidents.

## Workflow Permissions Audit

Every workflow declares a read-only `permissions: contents: read` default at the
top level. Any elevated scope is granted on the specific job that needs it, not
the whole workflow, so a compromised or buggy step in an unrelated job can't
inherit write access it doesn't need.

| Workflow | Default | Job-level exception | Why |
|----------|---------|----------------------|-----|
| `ci.yml` | `contents: read` | none | Build/test/lint only |
| `codeql-analysis.yml` | `contents: read`, `security-events: write` | none (single job) | `analyze` job must upload SARIF results |
| `dependency-audit.yml` | `contents: read` | none | `npm audit` only |
| `frontend-ci.yml` | `contents: read` | none | Build/test/lint only |
| `frontend-quality.yml` | `contents: read` | none | Build/test/lint only |
| `user-onboarding-ci.yml` | `contents: read` | none | Build/test/lint only |
| `testnet-integration.yml` | `contents: read` | none | Read-only API checks against live testnet |
| `smoke-testnet.yml` | `contents: read` | none | Read-only contract call against live testnet |
| `backend-deploy.yml` | `contents: read` | none | Deploys via Render webhook (`curl`); no repo writes |
| `mainnet-deploy.yml` | `contents: read` | none | Deploys via Render webhook (`curl`); no repo writes |
| `contract-testnet-deploy.yml` | `contents: read` | `deploy-testnet`: `contents: write` | Commits the redeployed contract id back to the repo |
| `release.yml` | `contents: read` | `create-release`: `contents: write` | `ncipollo/release-action` publishes a draft GitHub Release |

### Periodic audit checklist

Run this whenever a workflow is added or its jobs/steps change, and at least
quarterly:

- [ ] Every workflow file has a top-level `permissions:` block (no file relies
      on the repository/org default token permissions).
- [ ] The top-level default is `contents: read` unless the workflow has no
      job that touches repo contents or the GitHub API at all.
- [ ] Any scope beyond `contents: read` (`contents: write`, `security-events:
      write`, `id-token: write`, `pull-requests: write`, etc.) is declared on
      the specific job that needs it, not the workflow default, unless the
      workflow has exactly one job.
- [ ] Each such exception is documented (table above + inline comment in the
      workflow) with the reason it's required.
- [ ] Deploy and release workflows use a GitHub `environment` (`staging`,
      `production`, `testnet`) so elevated permissions and secrets are gated
      by environment protection rules, not just the workflow trigger.
- [ ] No workflow echoes secrets to logs or passes them to untrusted third-party
      actions.

## Pipeline Overview

| Workflow | Purpose | Security gate |
|----------|---------|---------------|
| `ci.yml` | PR/push validation | data-integrity, lint, test, build, `security-audit`, `cargo audit` |
| `codeql-analysis.yml` | SAST | JavaScript/TypeScript security queries |
| `dependency-audit.yml` | Weekly npm audit | Fails on high+ severity |
| `backend-deploy.yml` | Staging CD | Runs only after CI succeeds on `main`; post-deploy smoke optional |
| `mainnet-deploy.yml` | Production CD | Manual only; GitHub `production` environment |

## Dependency CVE Triage

1. Check failing job output (`security-audit` or `dependency-audit`).
2. Identify affected workspace (`backend` or `frontend`).
3. Prefer Dependabot PR or `npm audit fix` with review.
4. If no fix exists, document risk acceptance in the PR until upstream patches land.

## Leaked Secret Response

1. **Rotate immediately** — Render deploy hooks, `STELLAR_SECRET_KEY`, JWT secrets, database URLs.
2. Revoke the exposed credential in the provider console.
3. Search git history; if committed, treat as compromised even after removal.
4. Re-run deploy workflows after rotation.

## Workflow Compromise

1. Disable affected workflow in GitHub Actions settings.
2. Review recent workflow runs for unexpected `contents: write` usage.
3. Audit `.github/workflows/` diffs on `main` for the last 7 days.
4. Restore from last known-good commit if malicious steps are found.

## Rollback

| Change type | Rollback |
|-------------|----------|
| CI workflow | Revert commit on `main`; next push/PR uses restored config |
| Deploy | Render dashboard → previous deploy revision, or revert + redeploy |
| CodeQL / audit false positive | Temporarily adjust query/audit level in PR with documented reason |

## Operational Impact

- Blocking `npm audit` on PRs may delay merges until dependencies are patched.
- `backend-deploy` no longer triggers directly on push; it waits for CI success (adds ~5–15 min latency).
- Post-deploy smoke checks require repo variable `BACKEND_SMOKE_URL` (e.g. staging API base URL).

## Related

- [SECURITY.md](../../SECURITY.md)
- [CI/CD compliance](../compliance/cicd-wave5.md)
- [Observability runbook](./observability.md)
- [Ops deployment & rollback](./ops-deployment-rollback.md)
