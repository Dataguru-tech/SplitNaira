import type { NextFunction, Request, Response } from "express";
import { getDataSource } from "../services/database.js";
import { AuditLog } from "../entities/AuditLog.js";
import { hashIp } from "./payments-admin.js";
import { logger } from "../services/logger.js";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function deriveAction(req: Request): string {
  const path = req.path.replace(/^\/+/, "");
  const segments = path.split("/").filter(Boolean);
  const resource = segments[segments.length - 1] ?? "unknown";
  return resource.replace(/-/g, "_");
}

function buildPayload(req: Request): Record<string, unknown> | null {
  const body = req.body;
  if (body === undefined || body === null) {
    return null;
  }
  if (typeof body === "object" && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  return { value: body };
}

function buildFailureMetadata(req: Request, res: Response): Record<string, unknown> {
  return {
    action: deriveAction(req),
    requestId: String(res.locals.requestId ?? ""),
    route: req.originalUrl,
    statusCode: res.statusCode,
  };
}

async function persistAuditLog(
  req: Request,
  res: Response,
  outcome: "success" | "failure"
): Promise<void> {
  try {
    const dataSource = getDataSource();
    const repository = dataSource.getRepository(AuditLog);
    const entry = repository.create({
      action: deriveAction(req),
      ipHash: hashIp(req.ip),
      requestId: String(res.locals.requestId ?? ""),
      payload: outcome === "success" ? buildPayload(req) : buildFailureMetadata(req, res)
    });
    await repository.save(entry);
  } catch (error) {
    logger.error("Failed to persist admin audit log", { error, path: req.originalUrl });
  }
}

/**
 * Records an audit log row after each admin mutation under /splits/admin.
 * Successful mutations (2xx) are logged with the request payload.
 * Failed mutations (non-2xx) are logged with sanitized failure metadata
 * (action, requestId, route, statusCode) — never raw headers or tokens.
 */
export function auditAdminMutationsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!MUTATION_METHODS.has(req.method)) {
    next();
    return;
  }

  res.on("finish", () => {
    const outcome = res.statusCode >= 200 && res.statusCode < 300
      ? "success"
      : "failure";
    void persistAuditLog(req, res, outcome);
  });

  next();
}
