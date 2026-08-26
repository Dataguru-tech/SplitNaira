import { Request, Response, NextFunction } from "express";

const DEFAULT_TIMEOUT_MS = 30_000;

export function requestTimeout(ms = DEFAULT_TIMEOUT_MS) {
  return (req: Request, res: Response, next: NextFunction) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).json({
          error: "gateway_timeout",
          code: "GATEWAY_TIMEOUT",
          message: "Request timed out.",
          requestId: res.locals.requestId,
          details: {},
        });
      }
    }, ms);

    const clear = () => clearTimeout(timer);
    res.on("finish", clear);
    res.on("close", clear);
    next();
  };
}
