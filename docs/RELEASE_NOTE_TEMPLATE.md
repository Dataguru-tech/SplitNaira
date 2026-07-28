# Release Note Template
<!-- Copy this into the PR description or a draft GitHub Release. Keep entries short —
     this is a fill-in-the-blank, not an essay. "Features"/"Fixes" map to CHANGELOG.md's
     "Added"/"Fixed" sections (Keep a Changelog); reuse the same wording in both places. -->

## Release: vX.Y.Z — YYYY-MM-DD

## Features
<!-- e.g. Added API idempotency key support for create-split requests (#888) -->
-

## Fixes
<!-- e.g. Fixed 404 page rendering broken internal links (#970) -->
-

## Security
<!-- e.g. Tightened CORS to an explicit allow-list in production (#968) -->
-

## Migrations
<!-- Link the actual mechanism, don't re-explain it:
     - DB schema: docs/backend-deploy.md#database-migrations (`npm run migration:run`)
     - Contract/storage: docs/contract-release-and-upgrade-runbook.md + the ADR at
       docs/adr/0001-contract-upgrade-decision-record.md -->
- [ ] No migrations required
- [ ] Migration included — steps / rollback link:

## Known Issues
<!-- Be specific and honest: what breaks, who is affected, any workaround.
     Weak: "some edge cases may fail."
     Useful: "Bulk export times out for splits with >500 collaborators;
              workaround: paginate via the API." -->
-

## Docs & Screenshots Checklist
- [ ] Documentation updated (link: )
- [ ] Screenshots attached for UI-visible changes
- [ ] Migration steps verified against a staging/test DB
- [ ] `CHANGELOG.md` entry added under `[Unreleased]`

---
See [docs/RELEASE_RUNBOOK.md](./RELEASE_RUNBOOK.md) for the full pre-release checklist
and [docs/release-readiness-checklist.md](./release-readiness-checklist.md) for the
contract/infra sign-off gate.

A worked example filled in from this repo's own history is at
[docs/DRAFT_RELEASE_NOTES_EXAMPLE.md](./DRAFT_RELEASE_NOTES_EXAMPLE.md).
