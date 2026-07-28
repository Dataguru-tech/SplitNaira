# Frontend Performance Profiling Workflow

This doc covers two things:

1. How to run the dashboard render performance smoke test locally.
2. How to profile a real render-performance regression if that smoke test
   ever fails (or a user reports a slow dashboard) using React DevTools /
   Chrome DevTools against the actual running app.

## 1. Running the performance smoke test

The smoke test lives at
`frontend/src/components/dashboard/DashboardView.perf.test.tsx`. It renders
`DashboardView` once with a deterministic 800-project fixture and asserts:

- The render completes within a generous time budget (3000ms — see the
  comment above the assertion in the test file for the full rationale).
- The output is actually correct at that scale: the "Total Managed" summary
  reflects the full fixture count, the first and last projects in the list
  both appear in the "Project Performance Rollups" table, and every project
  ID is present exactly once.

Run it on its own:

```sh
cd frontend
npx vitest run src/components/dashboard/DashboardView.perf.test.tsx
```

Or with the verbose reporter, which is useful if you want to see per-test
timing output:

```sh
npx vitest run src/components/dashboard/DashboardView.perf.test.tsx --reporter=verbose
```

This test is part of the regular suite, so `npm run test` from `frontend/`
also runs it.

### What a failure means

The threshold is intentionally coarse (see the in-file comment), so a
failure most likely means one of:

- A genuine regression was introduced (e.g. an accidental O(n²) loop over
  `dashboardData`, a broken memoization boundary causing repeated
  re-renders, or removal of the one place this table currently gets away
  without virtualization).
- The CI runner was unusually slow/contended. If reruns are consistently
  fast locally and only a shared CI runner trips the threshold, that's a
  signal to raise the budget, not to chase a phantom regression.

If you suspect a real regression, move on to profiling below.

## 2. Profiling a real regression

The smoke test only tells you *that* something got slower, not *why*. To
investigate, profile the actual running app rather than the test:

1. Start the dev server from the repo root:

   ```sh
   npm run dev:frontend
   ```

   (equivalent to `cd frontend && npm run dev`)

2. Open the dashboard view in the browser with a realistically large
   dataset (or temporarily point the dashboard at test data matching the
   shape used in the perf smoke fixture, e.g. several hundred projects).

3. **React DevTools Profiler** (recommended first step):
   - Install/open the React DevTools browser extension.
   - Switch to the "Profiler" tab.
   - Click record, trigger the render you want to inspect (e.g. reload the
     dashboard, or trigger whatever state change causes a re-render), then
     stop recording.
   - Look at the flamegraph/ranked view for `DashboardView` and its
     children. Wide bars or components that re-render far more often than
     you'd expect are the usual suspects.

4. **Chrome DevTools Performance tab** (for lower-level detail, e.g. layout
   thrashing or long tasks that React DevTools doesn't attribute clearly):
   - Open DevTools → Performance tab.
   - Click record, trigger the render, stop recording.
   - Look at the main thread flame chart for long "Scripting" blocks during
     the render, and check the "Bottom-Up"/"Call Tree" views to see which
     function is actually consuming the time.

### Known likely bottleneck: the unvirtualized rollups table

The most probable source of any real dashboard render regression is the
"Project Performance Rollups" table in
`frontend/src/components/dashboard/DashboardView.tsx`. It `.map()`s over
the **entire** `dashboardData` array unconditionally, with no pagination,
no windowing, and one `<tr>` (plus several `sanitizeText()` calls) per
project. Unlike the "Your Cumulative Earnings" section above it — which
first `.filter()`s down to the current wallet's projects — this table has
no upper bound on how many rows it renders.

If profiling confirms this table is the actual bottleneck for a genuine
large-dataset regression, the natural fix is **list virtualization** (e.g.
[`react-window`](https://github.com/bvaughn/react-window) or
[`@tanstack/react-virtual`](https://github.com/TanStack/virtual)) so only
the rows currently in the viewport are mounted. That is out of scope for
this issue — this doc is informational, to give the next person a starting
point rather than requiring them to rediscover it from scratch.
