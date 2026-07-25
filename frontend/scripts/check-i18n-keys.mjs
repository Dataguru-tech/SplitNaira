#!/usr/bin/env node
// Issue #872: fails CI when a locale's message keys drift from the base
// locale (en) — missing keys silently fall back to raw keys at runtime,
// extra keys are usually leftover cruft from a removed feature.
//
// Usage: node scripts/check-i18n-keys.mjs
// To intentionally allow a locale to differ from `en` for a specific key,
// add it to messages/i18n-ignore.json (see that file's shape below).

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MESSAGES_DIR = path.join(__dirname, "..", "messages");
const IGNORE_FILE = path.join(MESSAGES_DIR, "i18n-ignore.json");

// Keep in sync with frontend/src/i18n/routing.ts `defaultLocale`.
const BASE_LOCALE = "en";

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function flattenKeys(obj, prefix = "") {
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...flattenKeys(value, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

function loadIgnoreList() {
  if (!existsSync(IGNORE_FILE)) {
    return { ignoreMissingKeys: {}, ignoreExtraKeys: {} };
  }
  const parsed = readJson(IGNORE_FILE);
  return {
    ignoreMissingKeys: parsed.ignoreMissingKeys ?? {},
    ignoreExtraKeys: parsed.ignoreExtraKeys ?? {},
  };
}

function discoverLocaleFiles() {
  return readdirSync(MESSAGES_DIR)
    .filter((name) => name.endsWith(".json") && name !== "i18n-ignore.json")
    .map((name) => ({
      locale: name.replace(/\.json$/, ""),
      filePath: path.join(MESSAGES_DIR, name),
    }));
}

function main() {
  const localeFiles = discoverLocaleFiles();
  const baseFile = localeFiles.find((f) => f.locale === BASE_LOCALE);

  if (!baseFile) {
    console.error(`i18n check: base locale "${BASE_LOCALE}" not found in ${MESSAGES_DIR}`);
    process.exit(1);
  }

  const baseKeys = new Set(flattenKeys(readJson(baseFile.filePath)));
  const { ignoreMissingKeys, ignoreExtraKeys } = loadIgnoreList();

  let hasFailures = false;

  for (const { locale, filePath } of localeFiles) {
    if (locale === BASE_LOCALE) continue;

    const localeKeys = new Set(flattenKeys(readJson(filePath)));
    const ignoredMissing = new Set(ignoreMissingKeys[locale] ?? []);
    const ignoredExtra = new Set(ignoreExtraKeys[locale] ?? []);

    const missing = [...baseKeys]
      .filter((key) => !localeKeys.has(key) && !ignoredMissing.has(key))
      .sort();
    const extra = [...localeKeys]
      .filter((key) => !baseKeys.has(key) && !ignoredExtra.has(key))
      .sort();

    if (missing.length === 0 && extra.length === 0) {
      console.log(`i18n check: ${locale}.json — OK (${localeKeys.size} keys)`);
      continue;
    }

    hasFailures = true;
    console.error(`i18n check: ${locale}.json — MISMATCH vs ${BASE_LOCALE}.json`);
    if (missing.length > 0) {
      console.error(`  Missing (present in ${BASE_LOCALE}.json, absent in ${locale}.json):`);
      for (const key of missing) console.error(`    - ${key}`);
    }
    if (extra.length > 0) {
      console.error(`  Extra (present in ${locale}.json, absent in ${BASE_LOCALE}.json):`);
      for (const key of extra) console.error(`    - ${key}`);
    }
  }

  if (hasFailures) {
    console.error(
      "\ni18n check failed. Add the key to every locale, remove the stray key, " +
        "or add an explicit exception to frontend/messages/i18n-ignore.json.",
    );
    process.exit(1);
  }

  console.log("i18n check: all locales match.");
}

main();
