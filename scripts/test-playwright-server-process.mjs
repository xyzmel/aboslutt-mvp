import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import {
  getNpmCommand,
  getCommandInvocation,
  getSpawnOptions,
  runCommand,
  terminateProcessTree,
} from "./playwright-process.mjs";

test("Windows npm uses npm.cmd through cmd.exe", () => {
  assert.equal(getNpmCommand("win32"), "npm.cmd");
  const options = getSpawnOptions({ platform: "win32", cwd: "C:\\repo", env: {}, stdio: "inherit" });
  const invocation = getCommandInvocation("npm.cmd", ["run", "build"], "win32");
  assert.match(invocation.command.toLowerCase(), /cmd\.exe$/);
  assert.deepEqual(invocation.args, ["/d", "/s", "/c", "npm.cmd", "run", "build"]);
  assert.equal(options.shell, false);
  assert.equal(options.windowsHide, true);
  assert.equal(options.cwd, "C:\\repo");
});

test("Linux CI keeps direct npm spawning without a shell", () => {
  assert.equal(getNpmCommand("linux"), "npm");
  const options = getSpawnOptions({ platform: "linux", cwd: "/repo", env: {}, stdio: "inherit" });
  assert.equal(options.shell, false);
  assert.equal(options.windowsHide, true);
  assert.equal(options.cwd, "/repo");
});

test("the current platform can launch npm successfully", async () => {
  await runCommand(getNpmCommand(), ["--version"], { stdio: "ignore" });
});

test("child-process failures propagate the exit code", async () => {
  const fakeSpawn = () => {
    const child = new EventEmitter();
    queueMicrotask(() => child.emit("exit", 7, null));
    return child;
  };
  await assert.rejects(
    runCommand("npm.cmd", ["run", "missing"], { stdio: "ignore", platform: "win32", spawnImpl: fakeSpawn }),
    (error) => {
      assert.equal(error.exitCode, 7);
      assert.match(error.message, /kode 7/);
      return true;
    },
  );
});

test("Linux shutdown sends SIGTERM to the server", async () => {
  const child = createFakeChild(100);
  await terminateProcessTree(child, { platform: "linux" });
  assert.deepEqual(child.kills, ["SIGTERM"]);
});

test("Windows shutdown terminates the complete process tree", async () => {
  const child = createFakeChild(321);
  const calls = [];
  await terminateProcessTree(child, {
    platform: "win32",
    spawnImpl(command, args, options) {
      calls.push({ command, args, options });
      const killer = new EventEmitter();
      queueMicrotask(() => killer.emit("exit", 0));
      return killer;
    },
  });
  assert.equal(calls[0].command, "taskkill.exe");
  assert.deepEqual(calls[0].args, ["/pid", "321", "/T", "/F"]);
  assert.equal(calls[0].options.shell, false);
});

function createFakeChild(pid) {
  return {
    pid,
    exitCode: null,
    kills: [],
    kill(signal) {
      this.kills.push(signal);
      return true;
    },
  };
}
