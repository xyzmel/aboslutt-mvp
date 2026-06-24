import { readFile } from "node:fs/promises";
import path from "node:path";

export default async function globalSetup() {
  const e2eUrl = process.env.E2E_DATABASE_URL?.trim();
  if (!e2eUrl) {
    throw new Error(
      "E2E_DATABASE_URL mangler. Playwright nekter å bruke den vanlige databasen.",
    );
  }

  const normalDatabaseUrl = process.env.DATABASE_URL?.trim() || (await readEnvDatabaseUrl());
  if (normalDatabaseUrl && normalizeUrl(normalDatabaseUrl) === normalizeUrl(e2eUrl)) {
    throw new Error("E2E_DATABASE_URL kan ikke være den samme som DATABASE_URL.");
  }

  const parsed = new URL(e2eUrl);
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  const databaseName = parsed.pathname.replace(/^\//, "").toLowerCase();
  const explicitlySafeName = /(e2e|playwright|test)/.test(databaseName);

  if (!isLocal && !explicitlySafeName && process.env.E2E_ALLOW_REMOTE_DATABASE !== "true") {
    throw new Error(
      "Ekstern E2E-database må ha e2e/test/playwright i databasenavnet, eller godkjennes med E2E_ALLOW_REMOTE_DATABASE=true.",
    );
  }

  if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production" && process.env.CI_PRODUCTION === "true") {
    throw new Error("Playwrights destruktive E2E-oppsett kan ikke kjøres i produksjonsmiljøet.");
  }

  process.env.DATABASE_URL = e2eUrl;
}

async function readEnvDatabaseUrl() {
  try {
    const envPath = path.join(process.cwd(), ".env");
    const contents = await readFile(envPath, "utf8");
    const match = contents.match(/^DATABASE_URL=(.*)$/m);
    return match?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
  } catch {
    return "";
  }
}

function normalizeUrl(value: string) {
  try {
    const url = new URL(value);
    url.password = "";
    return url.toString();
  } catch {
    return value;
  }
}
