const DEFAULT_DEV_ORIGIN = "http://localhost:3000";

/**
 * Resolves the CORS origin allowlist from environment variables.
 *
 * - `CORS_ORIGIN` unset -> defaults to the local frontend dev server only.
 * - `CORS_ORIGIN` set -> comma-separated list of explicit allowed origins.
 * - Wildcard (`*`) is rejected outright in production; `config/env.ts`
 *   additionally enforces that `CORS_ORIGIN` is present at all in production.
 */
export function resolveCorsOrigins(env: NodeJS.ProcessEnv = process.env): string[] | false {
  const origins = env.CORS_ORIGIN
    ? env.CORS_ORIGIN.split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
    : [DEFAULT_DEV_ORIGIN];

  if (env.NODE_ENV === "production" && origins.includes("*")) {
    throw new Error(
      "CORS wildcard (*) is not allowed in production. Set CORS_ORIGIN to specific origin(s)."
    );
  }

  return origins.length > 0 ? origins : false;
}
