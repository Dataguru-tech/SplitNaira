## Reliability Improvements (Wave 5)

### Changes
- Added `requestTimeout` middleware to return 503 on slow requests
- Added unit tests for timeout middleware

### Rollback
Remove `requestTimeout` from `src/index.ts` middleware chain and delete `src/middleware/timeout.ts`.

## Graceful Shutdown (issue #868)

`src/index.ts` handles `SIGTERM`/`SIGINT` via a shared `shutdown()` closure. On
receipt of either signal, in order:

1. **Readiness flips immediately.** `markShuttingDown()` (`src/routes/health.ts`)
   sets an in-process flag that `GET /health/ready` checks first, before any
   other check. From this point `/health/ready` returns `503 { status:
   "not_ready", error: "shutting_down" }`, so a load balancer or orchestrator
   stops routing new traffic here without waiting for the rest of shutdown to
   finish. `GET /health/live` is intentionally left reporting `ok` until the
   process actually exits — liveness answers "is this process broken and in
   need of a restart," not "should traffic still be sent here."
2. **Open SSE connections are closed.** `closeAllSseConnections()`
   (`src/routes/events.ts`) ends every response tracked by the `/events` and
   `/events/transactions/:txHash` handlers. Without this, `server.close()`
   would otherwise hang until each client eventually disconnected on its own,
   since `http.Server#close` only stops accepting *new* connections — it does
   not forcibly close existing keep-alive/SSE sockets.
3. **The Soroban event listener's poll loop is stopped**
   (`stopEventListenerService()`).
4. **The database connection pool is closed**
   (`closeDatabase()` in `src/services/database.ts`).
5. **The HTTP server stops accepting connections** (`server.close()`), and
   the process exits `0` once its callback fires (or `1` on an error from
   `server.close`).

### Expected shutdown timeout

A fallback timer force-exits the process with code `1` if the steps above
haven't completed within **`SHUTDOWN_FORCE_TIMEOUT_MS` (default: `10000` /
10s)** of receiving the signal. Configure this via the environment variable
of the same name — increase it if your hosting platform sends `SIGTERM` well
before it forcibly kills the process, so in-flight requests have more time to
finish draining.

### Validation

`src/__tests__/graceful-shutdown.integration.test.ts` spawns the real server
process, sends it `SIGTERM`, and asserts:
- `/health/ready` flips to `503`/`shutting_down` before the process exits.
- An open SSE connection is actively closed rather than left hanging.
- The process exits `0` well inside the configured force-timeout.

Run it locally with a Postgres instance available (same requirements as
`health.ready.integration.test.ts`):
```bash
npm run test:shutdown -w backend
```