import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Issue #935: unit-level tests for the degraded-mode health response
// contract. These mock getDataSource()/checkSorobanReachability() directly
// (no real Postgres/RPC connection) so "slow but successful" states can be
// simulated deterministically and the suite runs locally without CI-only
// dependencies. See src/__tests__/health.ready.integration.test.ts for the
// real-Postgres integration counterpart (CI-gated).
//
// EventListenerService.js is mocked without `importOriginal` so this suite
// never has to load/transform the real module.

vi.mock("../services/database.js", () => ({
  getDataSource: vi.fn(),
}));

vi.mock("../services/stellar.js", () => ({
  checkSorobanReachability: vi.fn(),
}));

vi.mock("../services/EventListenerService.js", () => ({
  getServiceHealth: vi.fn(),
}));

vi.mock("../config/env.js", () => ({
  getEnvDiagnostics: vi.fn(),
}));

import { getDataSource } from "../services/database.js";
import { checkSorobanReachability } from "../services/stellar.js";
import { getServiceHealth } from "../services/EventListenerService.js";
import { getEnvDiagnostics } from "../config/env.js";
import { requestIdMiddleware } from "../middleware/request-id.js";
import { errorHandler } from "../middleware/error.js";
import {
  healthRouter,
  markStartupComplete,
  resetStartupComplete,
} from "./health.js";

function buildApp() {
  const app = express();
  app.use(requestIdMiddleware);
  app.use("/health", healthRouter);
  app.use(errorHandler);
  return app;
}

const app = buildApp();

// Fixture "secrets" - if any of these literal strings show up anywhere in a
// response body, that's a leak. Deliberately shaped like real config values
// (a full Postgres DSN with embedded credentials, an RPC URL with an
// API-key-looking path segment) so the redaction test is meaningful.
const FIXTURE_DATABASE_URL = "postgresql://dbuser:sup3rSecretPW@db.internal.example:5432/splitnaira";
const FIXTURE_RPC_URL = "https://rpc.example.com/v1/apikey_abc123SECRET";

function mockDb(query: () => Promise<unknown>) {
  vi.mocked(getDataSource).mockReturnValue({
    isInitialized: true,
    query,
  } as unknown as ReturnType<typeof getDataSource>);
}

function mockFastDb() {
  mockDb(() => Promise.resolve([{ one: 1 }]));
}

function mockSlowDb(delayMs: number) {
  mockDb(
    () =>
      new Promise((resolve) => {
        setTimeout(() => resolve([{ one: 1 }]), delayMs);
      })
  );
}

function mockDownDb(message: string) {
  mockDb(() => Promise.reject(new Error(message)));
}

function mockFastRpc() {
  vi.mocked(checkSorobanReachability).mockResolvedValue({
    rpc: { ok: true, latencyMs: 10 },
    contract: { ok: true, latencyMs: 10 },
  });
}

describe("GET /health/ready - degraded health contract (Issue #935)", () => {
  beforeEach(() => {
    markStartupComplete();
    vi.mocked(getEnvDiagnostics).mockReturnValue({ ok: true });
    vi.mocked(getServiceHealth).mockReturnValue({
      status: "healthy",
      lastSuccessfulPoll: new Date().toISOString(),
      consecutiveErrors: 0,
    });
    delete process.env.HEALTH_DB_DEGRADED_LATENCY_MS;
    delete process.env.HEALTH_RPC_DEGRADED_LATENCY_MS;
    process.env.DATABASE_URL = FIXTURE_DATABASE_URL;
    process.env.SOROBAN_RPC_URL = FIXTURE_RPC_URL;
  });

  afterEach(() => {
    resetStartupComplete();
    vi.resetAllMocks();
    delete process.env.HEALTH_DB_DEGRADED_LATENCY_MS;
    delete process.env.HEALTH_RPC_DEGRADED_LATENCY_MS;
    delete process.env.DATABASE_URL;
    delete process.env.SOROBAN_RPC_URL;
  });

  it("is fully ready: 200, all components up", async () => {
    mockFastDb();
    mockFastRpc();

    const res = await request(app).get("/health/ready");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ready");
    expect(res.body.components.env.ok).toBe(true);
    expect(res.body.components.db).toMatchObject({ status: "up" });
    expect(res.body.components.rpc).toMatchObject({ status: "up" });
    expect(res.body.components.contract).toMatchObject({ status: "up" });
    expect(res.body.components.eventListener.status).toBe("healthy");
  });

  it("is degraded via a slow database: 200, db degraded, overall degraded", async () => {
    process.env.HEALTH_DB_DEGRADED_LATENCY_MS = "5";
    mockSlowDb(40);
    mockFastRpc();

    const res = await request(app).get("/health/ready");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("degraded");
    expect(res.body.components.db.status).toBe("degraded");
    expect(res.body.components.db.latencyMs).toBeGreaterThanOrEqual(30);
    // Unaffected dependencies stay "up".
    expect(res.body.components.rpc.status).toBe("up");
  });

  it("is degraded via a slow Soroban RPC: 200, rpc degraded, overall degraded", async () => {
    mockFastDb();
    process.env.HEALTH_RPC_DEGRADED_LATENCY_MS = "5";
    vi.mocked(checkSorobanReachability).mockResolvedValue({
      rpc: { ok: true, latencyMs: 50 },
      contract: { ok: true, latencyMs: 3 },
    });

    const res = await request(app).get("/health/ready");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("degraded");
    expect(res.body.components.rpc.status).toBe("degraded");
    expect(res.body.components.rpc.latencyMs).toBe(50);
    expect(res.body.components.contract.status).toBe("up");
  });

  it("is degraded when only the background event listener is degraded", async () => {
    mockFastDb();
    mockFastRpc();
    vi.mocked(getServiceHealth).mockReturnValue({
      status: "degraded",
      lastSuccessfulPoll: null,
      consecutiveErrors: 3,
    });

    const res = await request(app).get("/health/ready");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("degraded");
    expect(res.body.components.eventListener.status).toBe("degraded");
  });

  it("is not_ready via database down: 503 (unchanged existing behavior)", async () => {
    mockDownDb(`connection error near ${FIXTURE_DATABASE_URL}`);
    mockFastRpc();

    const res = await request(app).get("/health/ready");

    expect(res.status).toBe(503);
    expect(res.body.status).toBe("not_ready");
    expect(res.body.error).toBe("database_unavailable");
    expect(res.body.components.db.status).toBe("down");
  });

  it("is not_ready via Soroban RPC down: 503 (unchanged existing behavior)", async () => {
    mockFastDb();
    vi.mocked(checkSorobanReachability).mockResolvedValue({
      rpc: { ok: false, message: `unreachable: ${FIXTURE_RPC_URL}` },
      contract: { ok: false, message: "Skipped because Soroban RPC is unreachable" },
    });

    const res = await request(app).get("/health/ready");

    expect(res.status).toBe(503);
    expect(res.body.status).toBe("not_ready");
    expect(res.body.error).toBe("rpc_unavailable");
    expect(res.body.components.rpc.status).toBe("down");
  });

  it("is not_ready via contract simulation down: 503 (unchanged existing behavior)", async () => {
    mockFastDb();
    vi.mocked(checkSorobanReachability).mockResolvedValue({
      rpc: { ok: true, latencyMs: 12 },
      contract: { ok: false, message: "contract not found" },
    });

    const res = await request(app).get("/health/ready");

    expect(res.status).toBe(503);
    expect(res.body.status).toBe("not_ready");
    expect(res.body.error).toBe("contract_unreachable");
    expect(res.body.components.contract.status).toBe("down");
  });

  it("is not_ready when env diagnostics are invalid (unchanged existing behavior)", async () => {
    vi.mocked(getEnvDiagnostics).mockReturnValue({
      ok: false,
      issues: [{ key: "DATABASE_URL", message: "invalid" }],
    });

    const res = await request(app).get("/health/ready");

    expect(res.status).toBe(503);
    expect(res.body.status).toBe("not_ready");
    expect(res.body.error).toBe("missing_config");
  });

  it("never leaks DATABASE_URL / RPC endpoint / credentials into dependency messages", async () => {
    mockDownDb(`password authentication failed, dsn=${FIXTURE_DATABASE_URL}`);
    vi.mocked(checkSorobanReachability).mockResolvedValue({
      rpc: { ok: false, message: `could not reach ${FIXTURE_RPC_URL}` },
      contract: { ok: false, message: "Skipped because Soroban RPC is unreachable" },
    });

    const res = await request(app).get("/health/ready");
    const serialized = JSON.stringify(res.body);

    expect(serialized).not.toContain(FIXTURE_DATABASE_URL);
    expect(serialized).not.toContain(FIXTURE_RPC_URL);
    expect(serialized).not.toContain("sup3rSecretPW");
    expect(serialized).not.toContain("apikey_abc123SECRET");
  });
});
