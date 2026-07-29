#!/usr/bin/env node

// Simple healthcheck script for deployment readiness verification
import { createServer } from "node:http";

const PORT = process.env.HEALTH_PORT ?? 9000;
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";

async function checkBackend() {
  const res = await fetch(`${BACKEND_URL}/health/live`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`Backend health check failed: ${res.status}`);
  return res.json();
}

const server = createServer(async (_req, res) => {
  try {
    const health = await checkBackend();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", backend: health }));
  } catch (err) {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "error", message: String(err) }));
  }
});

server.listen(PORT, () => console.log(`Healthcheck server on port ${PORT}`));
// Simple healthcheck script for deployment readiness verification