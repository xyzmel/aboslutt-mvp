import { spawn } from "node:child_process";

export function getNpmCommand(platform = process.platform) {
  return platform === "win32" ? "npm.cmd" : "npm";
}

export function getSpawnOptions({
  cwd = process.cwd(),
  env = process.env,
  stdio = "inherit",
} = {}) {
  return {
    cwd,
    env,
    stdio,
    shell: false,
    windowsHide: true,
  };
}

export function getCommandInvocation(command, args, platform = process.platform) {
  if (platform !== "win32") {
    return { command, args };
  }

  return {
    command: process.env.ComSpec || "cmd.exe",
    args: ["/d", "/s", "/c", command, ...args],
  };
}

export function startCommand(command, args, options = {}) {
  const spawnImpl = options.spawnImpl ?? spawn;
  const invocation = getCommandInvocation(command, args, options.platform);
  return spawnImpl(invocation.command, invocation.args, getSpawnOptions(options));
}

export function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = startCommand(command, args, options);
    child.once("error", (error) => {
      reject(new Error(`Kunne ikke starte ${formatCommand(command, args)}.`, { cause: error }));
    });
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      const suffix = signal ? `signal ${signal}` : `kode ${code ?? "ukjent"}`;
      const error = new Error(`${formatCommand(command, args)} avsluttet med ${suffix}.`);
      error.exitCode = code;
      error.signal = signal;
      reject(error);
    });
  });
}

export function terminateProcessTree(child, {
  platform = process.platform,
  spawnImpl = spawn,
} = {}) {
  if (!child?.pid || child.exitCode !== null) {
    return Promise.resolve();
  }

  if (platform !== "win32") {
    child.kill("SIGTERM");
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const killer = spawnImpl("taskkill.exe", ["/pid", String(child.pid), "/T", "/F"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "ignore",
      shell: false,
      windowsHide: true,
    });
    killer.once("error", () => {
      child.kill();
      resolve();
    });
    killer.once("exit", () => resolve());
  });
}

export function formatCommand(command, args) {
  return [command, ...args].join(" ");
}
