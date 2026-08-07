#!/usr/bin/env node
import { rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const targets = ["frontend/build", "backend/dist", "contracts/target"];

await Promise.all(
  targets.map((target) => rm(resolve(repoRoot, target), { recursive: true, force: true }))
);

console.log("Workspace cleaned.");
