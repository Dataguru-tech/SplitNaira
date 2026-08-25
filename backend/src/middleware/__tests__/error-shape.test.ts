import express from "express";
import request from "supertest";
import { describe, it, expect, beforeAll, vi } from "vitest";

import { requestIdMiddleware } from "../request-id.js";
import { errorHandler, notFoundHandler } from "../error.js";
import { authJwtMiddleware } from "../auth-jwt.js";

// Mock JWT service so auth middleware doesn't need real keys
vi.mock("../../services/jwt.js", () => ({
  verifyToken: vi.fn(() => {
    throw new Error("Token expired or invalid.");
  }),
  signToken: vi.fn(() => "mocked-token"),
}));

beforeAll(() => {
  process.env.HORIZON_URL = process.env.HORIZON_URL ?? "https://horizon.test";
  process.env.SOROBAN_RPC_URL = process.env.SOROBAN_RPC_URL ?? "https://soroban.test";
  process.env.SOROBAN_NETWORK_PASSPHRASE =
    process.env.SOROBAN_NETWORK_PASSPHRASE ?? "Test SDF Network";
  process.env.CONTRACT_ID =
    process.env.CONTRACT_ID ?? "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  process.env.SIMULATOR_ACCOUNT = process.env.SIMULATOR_ACCOUNT ?? "GTESTSIMULATOR";
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? "https://example.com/postgres";
});

/**
 * Issue #1028: Malformed JSON handling should be consistent across routes.
 * Issue #1032: Every error response should carry requestId.
 */
function createTestApp() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(requestIdMiddleware);

  // Minimal routes representing each domain area
  app.post("/splits", (_req, res) => res.json({ ok: true }));
  app.post("/users/register", (_req, res) => res.json({ ok: true }));
  app.post("/auth/password-reset/request", (_req, res) => res.json({ ok: true }));
  app.post("/splits/admin/allow-token", (_req, res) => res.json({ ok: true }));
  app.get("/users/me", authJwtMiddleware, (_req, res) => res.json({ ok: true }));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

const MALFORMED_JSON = "{ invalid json }";

describe("Issue #1028: Malformed JSON handling consistency", () => {
  it("returns stable error shape for POST /splits with malformed JSON", async () => {
    const app = createTestApp();
    const res = await request(app)
      .post("/splits")
      .set("Content-Type", "application/json")
      .send(MALFORMED_JSON)
      .expect(400);

    expect(res.body.error).toBe("invalid_json");
    expect(res.body.code).toBe("INVALID_JSON");
    expect(res.body.message).toBe("Malformed JSON in request body.");
    expect(res.body.requestId).toBeTruthy();
    expect(res.body.requestId.length).toBeGreaterThan(0);
    expect(res.body.details).toEqual({});
  });

  it("returns stable error shape for POST /users/register with malformed JSON", async () => {
    const app = createTestApp();
    const res = await request(app)
      .post("/users/register")
      .set("Content-Type", "application/json")
      .send(MALFORMED_JSON)
      .expect(400);

    expect(res.body.error).toBe("invalid_json");
    expect(res.body.code).toBe("INVALID_JSON");
    expect(res.body.requestId).toBeTruthy();
  });

  it("returns stable error shape for POST /auth with malformed JSON", async () => {
    const app = createTestApp();
    const res = await request(app)
      .post("/auth/password-reset/request")
      .set("Content-Type", "application/json")
      .send(MALFORMED_JSON)
      .expect(400);

    expect(res.body.error).toBe("invalid_json");
    expect(res.body.code).toBe("INVALID_JSON");
    expect(res.body.requestId).toBeTruthy();
  });

  it("returns stable error shape for POST /splits/admin/allow-token with malformed JSON", async () => {
    const app = createTestApp();
    const res = await request(app)
      .post("/splits/admin/allow-token")
      .set("Content-Type", "application/json")
      .send(MALFORMED_JSON)
      .expect(400);

    expect(res.body.error).toBe("invalid_json");
    expect(res.body.code).toBe("INVALID_JSON");
    expect(res.body.requestId).toBeTruthy();
  });

  it("does not leak parser stack trace in the response", async () => {
    const app = createTestApp();
    const res = await request(app)
      .post("/splits")
      .set("Content-Type", "application/json")
      .send(MALFORMED_JSON)
      .expect(400);

    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain("SyntaxError");
    expect(bodyStr).not.toContain("at position");
    expect(bodyStr).not.toContain("JSON.parse");
  });

  it("includes a non-empty requestId in body and header even without incoming header", async () => {
    const app = createTestApp();
    const res = await request(app)
      .post("/splits")
      .set("Content-Type", "application/json")
      .send(MALFORMED_JSON)
      .expect(400);

    expect(res.body.requestId).toBeTruthy();
    expect(res.body.requestId.length).toBeGreaterThan(0);
    expect(res.headers["x-request-id"]).toBeTruthy();
  });

  it("generates a requestId when none is provided", async () => {
    const app = createTestApp();
    const res = await request(app)
      .post("/splits")
      .set("Content-Type", "application/json")
      .send(MALFORMED_JSON)
      .expect(400);

    expect(res.body.requestId).toBeTruthy();
    expect(res.body.requestId.length).toBeGreaterThan(0);
  });
});

/**
 * Issue #1032: requestId on auth middleware error responses.
 */
describe("Issue #1032: Auth middleware requestId in error responses", () => {
  it("returns 401 with requestId when Authorization header is missing", async () => {
    const app = createTestApp();
    const res = await request(app)
      .get("/users/me")
      .expect(401);

    expect(res.body.error).toBe("unauthorized");
    expect(res.body.code).toBe("UNAUTHORIZED");
    expect(res.body.requestId).toBeTruthy();
    expect(res.body.requestId.length).toBeGreaterThan(0);
    expect(res.body.details).toEqual({});
  });

  it("returns 401 with requestId when token is malformed", async () => {
    const app = createTestApp();
    const res = await request(app)
      .get("/users/me")
      .set("Authorization", "Bearer bad-token-value")
      .expect(401);

    expect(res.body.error).toBe("unauthorized");
    expect(res.body.code).toBe("UNAUTHORIZED");
    expect(res.body.requestId).toBeTruthy();
    expect(res.body.details).toEqual({});
  });

  it("echoes back the x-request-id in auth 401 responses", async () => {
    const app = createTestApp();
    const customId = "auth-req-456";
    const res = await request(app)
      .get("/users/me")
      .set("x-request-id", customId)
      .expect(401);

    expect(res.body.requestId).toBe(customId);
  });
});

/**
 * Issue #1032: requestId on timeout error responses.
 */
describe("Issue #1032: Timeout middleware requestId", () => {
  it("timeout response includes requestId and stable error shape", async () => {
    // Test the middleware directly instead of through supertest (which has
    // its own timeout that conflicts with the request timeout).
    const { requestTimeout } = await import("../timeout.js");
    const app = express();
    app.use(express.json());
    app.use(requestIdMiddleware);
    app.use(requestTimeout(50)); // very short timeout for test
    app.get("/slow", async (_req, res) => {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      res.json({ ok: true });
    });
    app.use(errorHandler);

    const customId = "timeout-req-789";
    const res = await request(app)
      .get("/slow")
      .set("x-request-id", customId);

    // The timeout middleware should have responded with 504
    expect(res.status).toBe(504);
    expect(res.body.requestId).toBe(customId);
    expect(res.body.code).toBe("GATEWAY_TIMEOUT");
    expect(res.body.error).toBe("gateway_timeout");
    expect(res.body.details).toEqual({});
  });
});

/**
 * Issue #1032: Rate limiter includes requestId.
 */
describe("Issue #1032: Rate limiter error shape", () => {
  it("rate limit response includes requestId field", async () => {
    // Create a tight rate limiter for testing (2 req/window)
    const rateLimit = (await import("express-rate-limit")).default;
    const tightLimiter = rateLimit({
      windowMs: 60_000,
      limit: 2,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req: express.Request, res: express.Response) => {
        res.status(429).json({
          error: "rate_limited",
          code: "RATE_LIMITED",
          message: "Too many requests. Please try again later.",
          retryAfter: res.getHeader("Retry-After"),
          requestId: res.locals.requestId as string | undefined,
        });
      },
    });

    const app = express();
    app.use(express.json());
    app.use(requestIdMiddleware);
    app.use(tightLimiter);
    app.get("/test", (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);

    const customId = "ratelimit-req-001";
    // First two requests should succeed
    await request(app).get("/test").set("x-request-id", customId);
    await request(app).get("/test").set("x-request-id", customId);

    // Third request should be rate limited
    const r = await request(app)
      .get("/test")
      .set("x-request-id", customId);

    expect(r.status).toBe(429);
    expect(r.body.requestId).toBe(customId);
    expect(r.body.code).toBe("RATE_LIMITED");
  });
});
