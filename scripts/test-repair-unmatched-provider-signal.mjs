import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const originalUrl = new URL(
  "../prisma/migrations/20260624120000_add_subscription_provider_catalog/migration.sql",
  import.meta.url,
);
const repairUrl = new URL(
  "../prisma/migrations/20260625090000_repair_unmatched_provider_signal/migration.sql",
  import.meta.url,
);

test("repair migration preserves the original table definition", async () => {
  const [original, repair] = await Promise.all([
    readFile(originalUrl, "utf8"),
    readFile(repairUrl, "utf8"),
  ]);

  const originalTable = extractTableDefinition(original);
  const repairTable = extractTableDefinition(repair);

  assert.equal(
    normalizeSql(repairTable.replace("CREATE TABLE IF NOT EXISTS", "CREATE TABLE")),
    normalizeSql(originalTable),
  );
});

test("repair migration recreates every original index with safe guards", async () => {
  const [original, repair] = await Promise.all([
    readFile(originalUrl, "utf8"),
    readFile(repairUrl, "utf8"),
  ]);

  const originalIndexes = extractIndexes(original);
  const repairIndexes = extractIndexes(repair);

  assert.deepEqual(
    repairIndexes.map((sql) => normalizeSql(sql.replace(" INDEX IF NOT EXISTS ", " INDEX "))),
    originalIndexes.map(normalizeSql),
  );
  assert.equal(repairIndexes.every((sql) => sql.includes("IF NOT EXISTS")), true);
});

test("repair migration is forward-only and does not modify migration history", async () => {
  const repair = await readFile(repairUrl, "utf8");

  assert.doesNotMatch(repair, /\bDROP\b/i);
  assert.doesNotMatch(repair, /\bDELETE\b/i);
  assert.doesNotMatch(repair, /\bTRUNCATE\b/i);
  assert.doesNotMatch(repair, /\bUPDATE\b/i);
  assert.doesNotMatch(repair, /_prisma_migrations/i);
});

function extractTableDefinition(sql) {
  const match = sql.match(
    /CREATE TABLE(?: IF NOT EXISTS)? "UnmatchedProviderSignal" \([\s\S]*?\n\);/,
  );
  assert.ok(match, "UnmatchedProviderSignal table definition was not found");
  return match[0];
}

function extractIndexes(sql) {
  return [...sql.matchAll(
    /CREATE (?:UNIQUE )?INDEX(?: IF NOT EXISTS)? "UnmatchedProviderSignal_[^"]+"[\s\S]*?;/g,
  )].map((match) => match[0]);
}

function normalizeSql(sql) {
  return sql.replace(/\s+/g, " ").trim();
}
