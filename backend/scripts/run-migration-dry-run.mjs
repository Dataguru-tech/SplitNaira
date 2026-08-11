#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(scriptDir, "..");

function ensureEnv(key, value) {
  if (!process.env[key] && value !== undefined) {
    process.env[key] = value;
  }
}

function parseDatabaseUrl(url) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port || "5432",
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\/+/, "") || "postgres",
  };
}

function buildAdminConnectionString(databaseUrl) {
  const adminDb = process.env.MIGRATION_ADMIN_DATABASE || "postgres";
  if (process.env.MIGRATION_ADMIN_DATABASE_URL) {
    return process.env.MIGRATION_ADMIN_DATABASE_URL;
  }

  const parsed = new URL(databaseUrl);
  parsed.pathname = `/${adminDb}`;
  return parsed.toString();
}

async function resetDatabase(databaseUrl) {
  const targetDatabase = parseDatabaseUrl(databaseUrl).database;
  const adminConnectionString = buildAdminConnectionString(databaseUrl);

  console.log(`[migration:dry-run] Resetting database ${targetDatabase} for a fresh migration run`);

  const client = new Client({ connectionString: adminConnectionString });
  await client.connect();

  try {
    await client.query(`DROP DATABASE IF EXISTS "${targetDatabase}" WITH (FORCE)`);
    await client.query(`CREATE DATABASE "${targetDatabase}"`);
  } finally {
    await client.end();
  }
}

function runMigrations() {
  const result = spawnSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "typeorm", "--", "migration:run", "-d", "src/data-source.ts"],
    {
      cwd: backendRoot,
      stdio: "inherit",
      env: process.env,
    }
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function main() {
  ensureEnv("NODE_ENV", "test");
  ensureEnv("PORT", "3001");
  ensureEnv("CORS_ORIGIN", "http://localhost:3000");
  ensureEnv("LOG_LEVEL", "info");
  ensureEnv("DATABASE_URL", "postgresql://splitnaira:splitnaira@localhost:5432/splitnaira_ci");
  ensureEnv("HORIZON_URL", "https://horizon-testnet.stellar.org");
  ensureEnv("SOROBAN_RPC_URL", "https://soroban-testnet.stellar.org");
  ensureEnv("SOROBAN_NETWORK_PASSPHRASE", "Test SDF Network ; September 2015");
  ensureEnv("CONTRACT_ID", "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
  ensureEnv("SIMULATOR_ACCOUNT", "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF");

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run migration dry-run checks.");
  }

  console.log("[migration:dry-run] Starting TypeORM migration verification against a fresh database");
  await resetDatabase(databaseUrl);
  runMigrations();
  console.log("[migration:dry-run] Completed successfully.");
}

main().catch((error) => {
  console.error("[migration:dry-run] Failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
