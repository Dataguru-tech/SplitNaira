import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError, ErrorCode, ErrorType } from "../lib/errors.js";
import { logger } from "../services/logger.js";
import { RpcError, RpcTimeoutError } from "../services/stellar.js";

const isProduction = process.env.NODE_ENV === "production";

function formatZodError(err: ZodError) {
  const flattened = err.flatten();
  return {
    code: "VALIDATION_ERROR",
    error: "validation_error",
    message: "Invalid request payload.",
    details: { fieldErrors: flattened.fieldErrors, formErrors: flattened.formErrors },
  };
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: "not_found",
    code: "NOT_FOUND",
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    requestId: res.locals.requestId,
    details: {},
  });
}

/**
 * Maps an AppError to an HTTP status code.
 *
 * ASSUMPTION: this only knows about the ErrorCode/ErrorType members
 * already referenced in the original handler (NOT_FOUND, VALIDATION,
 * AUTH). If lib/errors.js defines more (CONFLICT, FORBIDDEN,
 * RATE_LIMITED, etc.), add them below — otherwise they'll silently fall
 * through to 500.
 *
 * Checks for an explicit `statusCode` on the error first. Longer term
 * it's more robust to have AppError carry its own status at the point
 * it's thrown (`throw new AppError(..., { statusCode: 409 })`) than to
 * have this handler reverse-engineer HTTP semantics from a business enum
 * — this function supports that without requiring it.
 */
function resolveAppErrorStatus(err: AppError): number {
  const explicitStatus = (err as AppError & { statusCode?: unknown }).statusCode;
  if (typeof explicitStatus === "number") {
    return explicitStatus;
  }

  if (err.code === ErrorCode.NOT_FOUND) return 404;
  if (err.type === ErrorType.VALIDATION) return 400;
  // Auth *failures* (missing/invalid credentials) are 401, not 400. The
  // original mapping returned 400 here, which tells the client "your
  // request is malformed" instead of "you're not authenticated" — the
  // wrong signal for e.g. a frontend deciding whether to redirect to login.
  if (err.type === ErrorType.AUTH) return 401;
  return 500;
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // If a response has already started streaming, sending another JSON
  // body throws "Cannot set headers after they are sent" and crashes the
  // process instead of gracefully handling the error. Hand off to
  // Express's default handler in that case.
  if (res.headersSent) {
    return next(err);
  }

  const requestId = res.locals.requestId;

  // Real instanceof check instead of duck-typing on err.name/err.issues —
  // ZodError is a real exported class, so this is both simpler and more
  // reliable than reflecting on shape.
  if (err instanceof ZodError) {
    return res.status(400).json({
      ...formatZodError(err),
      requestId,
    });
  }

  if (err instanceof AppError) {
    const status = resolveAppErrorStatus(err);

    // Client-caused errors (bad input, bad/missing auth, not found) are
    // expected traffic, not bugs in our code — log them at `warn` so they
    // don't pollute error-rate alerts the way a genuine 500 should.
    const logLevel = status >= 500 ? "error" : "warn";
    logger[logLevel]("Application error", {
      requestId,
      path: req.originalUrl,
      method: req.method,
      type: err.type,
      code: err.code,
      message: err.message,
      details: err.details,
    });

    return res.status(status).json({
      error: err.code.toLowerCase(),
      code: err.code,
      message: err.message,
      requestId,
      // Previously `err.details || { remediation: err.remediation }` —
      // if details existed but had no remediation baked in, remediation
      // was silently dropped. Merge both instead of picking one.
      details: {
        ...err.details,
        ...(err.remediation ? { remediation: err.remediation } : {}),
      },
    });
  }

  // RPC errors are expected, transient failure modes of talking to an
  // external dependency (Horizon/soroban-rpc), not bugs in this service.
  // Handling them here — before the generic "unhandled error" path below
  // — means they're logged at a level that reflects "dependency hiccup"
  // rather than "our code broke", and they're never reported to Sentry as
  // an unhandled exception.
  if (err instanceof RpcTimeoutError) {
    logger.warn("RPC timeout", { requestId, path: req.originalUrl, message: err.message });
    return res.status(504).json({
      error: "timeout_error",
      code: "RPC_TIMEOUT",
      message: err.message,
      requestId,
      details: {},
    });
  }

  if (err instanceof RpcError) {
    logger.warn("RPC error", {
      requestId,
      path: req.originalUrl,
      statusCode: err.statusCode,
      message: err.message,
    });
    return res.status(err.statusCode).json({
      error: "rpc_error",
      code: "RPC_ERROR",
      message: err.message,
      requestId,
      details: {},
    });
  }

  // Anything left is genuinely unexpected. A thrown value isn't
  // guaranteed to be an Error instance (`throw "oops"` is legal JS), so
  // normalize it before touching .stack/.message.
  const normalizedErr = err instanceof Error ? err : new Error(String(err));

  logger.error("Unhandled error", {
    requestId,
    path: req.originalUrl,
    method: req.method,
    err: normalizedErr.stack || normalizedErr.message,
  });

  if (process.env.SENTRY_DSN) {
    void import("@sentry/node").then((Sentry) => {
      Sentry.withScope((scope) => {
        scope.setTag("requestId", requestId);
        Sentry.captureException(normalizedErr);
      });
    });
  }

  res.status(500).json({
    error: "internal_error",
    code: "INTERNAL_ERROR",
    // Never leak internal error messages (stack traces, DB connection
    // errors, third-party error text) to the client in production — the
    // real message is already captured in the log line above. In dev, show
    // it for faster debugging.
    message: isProduction ? "Unexpected server error." : normalizedErr.message,
    requestId,
    details: {},
  });
}