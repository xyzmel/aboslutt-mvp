import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  formatCommand,
  getNpmCommand,
  runCommand,
  startCommand,
  terminateProcessTree,
} from "./playwright-process.mjs";

const cwd = process.cwd();
const databaseUrl = process.env.E2E_DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("E2E_DATABASE_URL må være satt før Playwright kan starte.");
  process.exit(1);
}

const database = validateE2eDatabaseUrl(databaseUrl);
const port = validatePort(process.env.E2E_PORT || "3100");
const baseUrl = process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`;
const npmCommand = getNpmCommand();
const env = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  NEXTAUTH_URL: baseUrl,
  NEXT_PUBLIC_SITE_URL: baseUrl,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "playwright-only-nextauth-secret-change-me",
  NODE_ENV: "production",
  ABOSLUTT_ENABLE_DEMO_FALLBACK: "false",
  GOOGLE_MAIL_CONNECT_ENABLED: "false",
  EMAIL_SERVER_HOST: "",
  EMAIL_SERVER_USER: "",
  EMAIL_SERVER_PASSWORD: "",
  EMAIL_FROM: "",
};

await assertSeparateDatabase(databaseUrl);
assertNonProductionEnvironment();

await executeNpm(["run", "prisma:deploy"]);
await executeNpm(["run", "prisma:seed"]);
if (process.env.E2E_SKIP_BUILD !== "true") {
  await executeNpm(["run", "build"]);
}

const serverArgs = ["run", "start", "--", "-p", String(port)];
logStartup(npmCommand, serverArgs);
const server = startCommand(npmCommand, serverArgs, { cwd, env });
let shuttingDown = false;

server.once("error", (error) => {
  console.error(`Kunne ikke starte Playwright-serveren: ${error.code ?? error.name}`);
  process.exit(1);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    void shutdown(signal);
  });
}

server.on("exit", (code, signal) => {
  if (shuttingDown) return;
  if (signal) {
    console.error(`Playwright-serveren stoppet med signal ${signal}.`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});

async function executeNpm(args) {
  logStartup(npmCommand, args);
  await runCommand(npmCommand, args, { cwd, env });
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  await terminateProcessTree(server);
  process.exit(signal === "SIGINT" ? 130 : 143);
}

function logStartup(command, args) {
  console.log(
    `[playwright-server] command="${formatCommand(command, args)}" platform=${process.platform} port=${port} databaseHost=${database.hostname}`,
  );
}

function validateE2eDatabaseUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    console.error("E2E_DATABASE_URL er ugyldig.");
    process.exit(1);
  }

  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    console.error("E2E_DATABASE_URL må være en PostgreSQL-database.");
    process.exit(1);
  }

  const databaseName = parsed.pathname.replace(/^\//, "").toLowerCase();
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  const explicitlySafeName = /(e2e|playwright|test)/.test(databaseName);
  if (!isLocal && !explicitlySafeName && process.env.E2E_ALLOW_REMOTE_DATABASE !== "true") {
    console.error("Ekstern E2E-database må ha e2e/test/playwright i databasenavnet.");
    process.exit(1);
  }

  return parsed;
}

async function assertSeparateDatabase(e2eUrl) {
  const normalDatabaseUrl = process.env.DATABASE_URL?.trim() || await readEnvDatabaseUrl();
  if (normalDatabaseUrl && normalizeUrl(normalDatabaseUrl) === normalizeUrl(e2eUrl)) {
    console.error("E2E_DATABASE_URL kan ikke være den samme som DATABASE_URL.");
    process.exit(1);
  }
}

function assertNonProductionEnvironment() {
  if (
    process.env.VERCEL_ENV === "production" ||
    (process.env.NODE_ENV === "production" && process.env.CI_PRODUCTION === "true")
  ) {
    console.error("Playwrights destruktive E2E-oppsett kan ikke kjøre i produksjonsmiljøet.");
    process.exit(1);
  }
}

async function readEnvDatabaseUrl() {
  try {
    const contents = await readFile(path.join(cwd, ".env"), "utf8");
    const match = contents.match(/^DATABASE_URL=(.*)$/m);
    return match?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
  } catch {
    return "";
  }
}

function normalizeUrl(value) {
  try {
    const url = new URL(value);
    url.password = "";
    return url.toString();
  } catch {
    return value;
  }
}

function validatePort(value) {
  if (!/^\d{2,5}$/.test(value)) {
    console.error("E2E_PORT må være et gyldig portnummer.");
    process.exit(1);
  }
  const parsed = Number(value);
  if (parsed < 1 || parsed > 65535) {
    console.error("E2E_PORT må være mellom 1 og 65535.");
    process.exit(1);
  }
  return parsed;
}
