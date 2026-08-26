import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../services/jwt.js";

export interface AuthenticatedUser {
  walletAddress: string;
}

// Extends Express's Request type so `req.user` is properly typed at every
// downstream call site instead of requiring `(req as any).user`. If you
// already have a global Express augmentation elsewhere, move this block
// there instead of duplicating it.
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

const BEARER_PREFIX = "bearer ";

// SplitNaira authenticates Stellar account/contract addresses in JWTs.
const STELLAR_ADDRESS_REGEX = /^[GC][A-Z2-7]{55}$/;

export function authJwtMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  // Authorization scheme names are case-insensitive per RFC 7235, so
  // "bearer", "Bearer", "BEARER" should all be accepted. The original
  // startsWith("Bearer ") would silently reject a valid token sent with
  // different casing by a client that doesn't happen to title-case it.
  const requestId = res.locals.requestId as string | undefined;

  if (!header || !header.toLowerCase().startsWith(BEARER_PREFIX)) {
    return res.status(401).json({ error: "unauthorized", code: "UNAUTHORIZED", message: "Missing or invalid token.", requestId, details: {} });
  }

  const token = header.slice(BEARER_PREFIX.length).trim();
  if (!token) {
    return res.status(401).json({ error: "unauthorized", code: "UNAUTHORIZED", message: "Missing or invalid token.", requestId, details: {} });
  }

  let payload: unknown;
  try {
    // Depending on the underlying JWT library, an expired/malformed/
    // tampered token can throw (e.g. jsonwebtoken's verify() throws
    // TokenExpiredError/JsonWebTokenError) rather than returning null.
    // Without this try/catch, a single bad token could crash the request
    // with an unhandled exception instead of returning a clean 401.
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({ error: "unauthorized", code: "UNAUTHORIZED", message: "Token expired or invalid.", requestId, details: {} });
  }

  if (!isAuthenticatedUser(payload)) {
    return res.status(401).json({ error: "unauthorized", code: "UNAUTHORIZED", message: "Token expired or invalid.", requestId, details: {} });
  }

  req.user = { walletAddress: payload.walletAddress };
  next();
}

// Narrows the decoded payload before trusting it. verifyToken's return
// type is often `any`/`JwtPayload` depending on the library, so a token
// that verifies successfully but is missing (or has a malformed)
// walletAddress claim would otherwise flow straight through as a valid
// authenticated user.
function isAuthenticatedUser(payload: unknown): payload is AuthenticatedUser {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }
  const walletAddress = (payload as Record<string, unknown>).walletAddress;
  return typeof walletAddress === "string" && STELLAR_ADDRESS_REGEX.test(walletAddress);
}