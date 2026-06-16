import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readEnvDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  try {
    const envPath = resolve(process.cwd(), ".env");
    const envContent = readFileSync(envPath, "utf8");
    const databaseUrlLine = envContent
      .split(/\r?\n/)
      .find((line) => line.trim().startsWith("DATABASE_URL="));

    if (!databaseUrlLine) {
      return null;
    }

    const rawValue = databaseUrlLine.slice(databaseUrlLine.indexOf("=") + 1).trim();
    return rawValue.replace(/^['"]|['"]$/g, "");
  } catch {
    return null;
  }
}

const databaseUrl = readEnvDatabaseUrl();
const isPostgresUrl =
  databaseUrl?.startsWith("postgresql://") || databaseUrl?.startsWith("postgres://");

if (!isPostgresUrl) {
  console.error(
    [
      "Invalid DATABASE_URL for Prisma Postgres commands.",
      "",
      'prisma/schema.prisma uses provider = "postgresql", so DATABASE_URL must start with:',
      "- postgresql://",
      "- postgres://",
      "",
      "Prisma CLI reads .env for local commands. Copy your Postgres connection string",
      "from Vercel, Neon, Supabase or another Postgres provider into .env before running",
      "npm run prisma:deploy or npm run prisma:seed.",
      "",
      'Do not use DATABASE_URL="file:./dev.db" with the Postgres schema.',
    ].join("\n"),
  );
  process.exit(1);
}
