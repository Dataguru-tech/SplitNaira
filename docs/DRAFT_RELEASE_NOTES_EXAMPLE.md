# Draft Release Notes — Worked Example

<!-- Produced by filling in docs/RELEASE_NOTE_TEMPLATE.md using this repo's own recent
     merge history (see `git log --oneline -20 main`), as validation that the template
     is usable in practice. This is illustrative, not a real published release. -->

## Release: v0.2.0 — 2026-07-26

## Features
- Added API idempotency key support for create-split requests, so retried POSTs
  no longer create duplicate splits (#887, #888, #889, #890)

## Fixes
- Fixed the 404 page rendering broken internal links (#970 area)
- Added missing test coverage for backend rate-limit headers and 429 responses,
  closing a gap where the limiter's behavior was unverified

## Security
- Added strict CORS test coverage for allowed/disallowed/missing/malformed
  `Origin` headers in production mode, confirming the allow-list rejects
  everything not explicitly permitted (#968)

## Migrations
- [x] No migrations required
- No DB schema or contract storage changes in this batch — see
  `docs/backend-deploy.md#database-migrations` and
  `docs/contract-release-and-upgrade-runbook.md` for when this section applies.

## Known Issues
- CORS and rate-limit coverage in this release is test-only confirmation of
  existing behavior, not a behavior change — operators relying on the previous
  (undocumented) limiter thresholds should confirm no client depends on
  undocumented retry timing before upgrading.

## Docs & Screenshots Checklist
- [x] Documentation updated (env var ownership doc merged same window, PR #971)
- [ ] Screenshots attached for UI-visible changes — N/A, no UI changes in this batch
- [x] Migration steps verified against a staging/test DB — N/A, no migrations
- [ ] `CHANGELOG.md` entry added under `[Unreleased]`

---
Source commits (`git log --oneline -20 main`): `096ae66` (idempotency key support),
`8935360` (CORS strict-prod tests), `df49f54` (404 page fix), `e7eafb7`
(rate-limit header tests).
