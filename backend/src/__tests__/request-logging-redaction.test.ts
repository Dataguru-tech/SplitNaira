// #946 — Backend tests: request logging interceptor must never emit cookie
// values or Authorization header contents in log output.
//
// Redacted fields:
//   cookie        → omitted entirely from the logged object
//   authorization → omitted entirely from the logged object
// Preserved fields:
//   method, path (url), correlationId, durationMs

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ExecutionContext, CallHandler } from "@nestjs/common";
import { of } from "rxjs";
import { RequestLoggingInterceptor } from "../observability/request-logging.interceptor.js";

function makeContext(headers: Record<string, string> = {}, extras: Record<string, unknown> = {}): ExecutionContext {
  const request = {
    method: "GET",
    url: "/api/projects",
    correlationId: "test-corr-id",
    headers,
    ...extras,
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function makeHandler(): CallHandler {
  return { handle: () => of(null) };
}

describe("RequestLoggingInterceptor — cookie and auth redaction (#946)", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let interceptor: RequestLoggingInterceptor;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    interceptor = new RequestLoggingInterceptor();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("logs method and path for a plain request", async () => {
    await new Promise<void>((resolve) => {
      interceptor
        .intercept(makeContext(), makeHandler())
        .subscribe({ complete: resolve });
    });

    expect(consoleSpy).toHaveBeenCalledOnce();
    const logged = JSON.parse(consoleSpy.mock.calls[0][0] as string);
    expect(logged.method).toBe("GET");
    expect(logged.path).toBe("/api/projects");
  });

  it("never logs a cookie header value", async () => {
    const ctx = makeContext({ cookie: "session=super-secret-token; other=value" });

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, makeHandler()).subscribe({ complete: resolve });
    });

    const raw = consoleSpy.mock.calls[0][0] as string;
    expect(raw).not.toContain("super-secret-token");
    expect(raw).not.toContain("session=");

    const logged = JSON.parse(raw);
    expect(logged.cookie).toBeUndefined();
    expect(logged.headers?.cookie).toBeUndefined();
  });

  it("never logs an Authorization header value", async () => {
    const ctx = makeContext({ authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret" });

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, makeHandler()).subscribe({ complete: resolve });
    });

    const raw = consoleSpy.mock.calls[0][0] as string;
    expect(raw).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
    expect(raw).not.toContain("Bearer ");

    const logged = JSON.parse(raw);
    expect(logged.authorization).toBeUndefined();
    expect(logged.headers?.authorization).toBeUndefined();
  });

  it("preserves correlationId in the log entry", async () => {
    const ctx = makeContext({}, { correlationId: "abc-123" });

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, makeHandler()).subscribe({ complete: resolve });
    });

    const logged = JSON.parse(consoleSpy.mock.calls[0][0] as string);
    expect(logged.correlationId).toBe("abc-123");
  });

  it("includes a non-negative durationMs", async () => {
    await new Promise<void>((resolve) => {
      interceptor.intercept(makeContext(), makeHandler()).subscribe({ complete: resolve });
    });

    const logged = JSON.parse(consoleSpy.mock.calls[0][0] as string);
    expect(typeof logged.durationMs).toBe("number");
    expect(logged.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("does not log both cookie and auth when both are present", async () => {
    const ctx = makeContext({
      cookie: "token=abc123",
      authorization: "Bearer secret-jwt",
    });

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, makeHandler()).subscribe({ complete: resolve });
    });

    const raw = consoleSpy.mock.calls[0][0] as string;
    expect(raw).not.toContain("abc123");
    expect(raw).not.toContain("secret-jwt");
  });
});
