---
name: Dependency Advisory Triage
about: Triage template for critical or high-severity dependency advisories
title: "[Security]: Dependency advisory – <package>@<version>"
labels: security, dependencies
assignees: ''
---

## Advisory Summary

| Field | Detail |
|-------|--------|
| **Package** | <!-- e.g. `express`, `@stellar/stellar-sdk` --> |
| **Affected versions** | <!-- e.g. `< 4.19.2` --> |
| **Fixed version** | <!-- e.g. `4.19.2` --> |
| **Severity** | <!-- Critical / High / Moderate / Low --> |
| **CVE / GHSA** | <!-- e.g. CVE-2024-XXXXX or GHSA-xxxx-xxxx-xxxx --> |
| **CVSS score** | <!-- e.g. 9.8 --> |
| **Source** | <!-- GitHub Dependabot / npm audit / Snyk / manual --> |

## Impact Assessment

**Which workspaces are affected?**
- [ ] `backend/`
- [ ] `frontend/`
- [ ] `contracts/`
- [ ] `libs/`
- [ ] Other: <!-- specify -->

**Is the vulnerable code path reachable in production?**
<!-- Describe the attack surface. Is the affected function/module called with untrusted input? -->

**Estimated risk given our usage:**
<!-- Low / Medium / High — explain briefly -->

## Remediation Plan

- [ ] Bump package to fixed version in the affected workspace(s)
- [ ] Run `npm audit` / `cargo audit` after upgrade and confirm clean
- [ ] Run affected workspace tests locally
- [ ] Update `SECURITY_FIX_SUMMARY.md` if the fix is non-trivial
- [ ] Verify CI passes (dependency-audit workflow)

**Target PR merge date:** <!-- e.g. within 24 h for Critical, 72 h for High -->

## Verification

- [ ] `npm audit --audit-level=high` exits 0 after upgrade
- [ ] No regression in affected workspace unit/integration tests
- [ ] CHANGELOG entry added if the upgrade is user-visible

## Notes

<!-- Additional context, workarounds applied in the interim, or links to upstream changelog -->
