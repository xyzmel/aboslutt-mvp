import { spawn } from "node:child_process";

const databaseUrl = process.env.E2E_DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("E2E_DATABASE_URL må være satt før Playwright kan starte.");
  process.exit(1);
}

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const port = process.env.E2E_PORT || "3100";
const baseUrl = process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`;
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

await run(npmCommand, ["run", "prisma:deploy"], env);
await run(npmCommand, ["run", "prisma:seed"], env);
if (process.env.E2E_SKIP_BUILD !== "true") {
  await run(npmCommand, ["run", "build"], env);
}

const server = spawn(npmCommand, ["run", "start", "--", "-p", port], {
  env,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}

server.on("exit", (code) => {
  process.exit(code ?? 1);
});

function run(command, args, commandEnv) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: commandEnv,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} avsluttet med kode ${code}`));
      }
    });
  });
}
