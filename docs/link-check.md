# Markdown Link Health Check

The CI pipeline validates relative links across all `docs/` and `runbooks/` Markdown files on every pull request that touches them.

## Running Locally

```bash
# Install the checker once
npm install -g markdown-link-check

# Check all docs
find docs runbooks -name "*.md" -print0 \
  | xargs -0 -I{} markdown-link-check \
      --config .github/markdown-link-check-config.json \
      --verbose \
      {}

# Check a single file
markdown-link-check --config .github/markdown-link-check-config.json docs/runbooks/rpc-provider-failover.md
```

## Configuration

The checker is configured in [`.github/markdown-link-check-config.json`](../.github/markdown-link-check-config.json):

- **External URLs are skipped** — only relative internal links are validated. This avoids flaky failures caused by third-party uptime and prevents unnecessary outbound traffic in CI.
- **Retry on HTTP 429** — the checker retries rate-limited responses up to twice before failing.

## Fixing Broken Links

When the check reports a broken link:

1. The output includes the **file path** and **line number** of the broken link.
2. Verify whether the target file was renamed, moved, or deleted.
3. Update the link in the source file to match the current path.
4. Re-run locally to confirm the fix before pushing.

## What Is Checked

| Scope | Checked |
|-------|---------|
| `docs/**/*.md` | Yes |
| `runbooks/**/*.md` | Yes |
| Root-level `*.md` files (`README.md`, `CONTRIBUTING.md`, …) | Yes |
| External `https://` URLs | No (intentionally excluded) |
| Anchor fragments (`#section`) | No (not supported by this tool) |
