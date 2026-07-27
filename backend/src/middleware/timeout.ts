import { Request, Response, NextFunction } from "express";
import { RpcTimeoutError } from "../services/stellar.js";

const DEFAULT_TIMEOUT_MS = 30_000;

export function requestTimeout(ms = DEFAULT_TIMEOUT_MS) {
  return (req: Request, res: Response, next: NextFunction) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        const requestId = res.locals.requestId;
        res.status(504).json({
          error: "gateway_timeout",
          message: "Request timed out.",
          ...(requestId ? { requestId } : {}),
        });
      }
    }, ms);

    const clear = () => clearTimeout(timer);
    res.on("finish", clear);
    res.on("close", clear);
    next();
  };
}
