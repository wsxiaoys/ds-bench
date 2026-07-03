#!/usr/bin/env node
/**
 * Reads the run id from /logs/artifacts/run-id, exports it as
 * NEXT_PUBLIC_RUN_ID, and then spawns `next dev` on port 3000.
 *
 * Falls back to a static value if the file is missing.
 */
import { readFileSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";

const RUN_ID_FILE = "/logs/artifacts/run-id";

function readRunId() {
  if (!existsSync(RUN_ID_FILE)) {
    console.warn(`[run-id] ${RUN_ID_FILE} not found, using 'default'`);
    return "default";
  }
  const value = readFileSync(RUN_ID_FILE, "utf8").trim();
  if (value.length === 0) {
    console.warn(`[run-id] ${RUN_ID_FILE} was empty, using 'default'`);
    return "default";
  }
  return value;
}

const runId = readRunId();
process.env.NEXT_PUBLIC_RUN_ID = runId;
console.log(`[run-id] Using NEXT_PUBLIC_RUN_ID=${runId}`);

const [, , ...args] = process.argv;
const command = args.length > 0 ? args[0] : "next";
const commandArgs = args.length > 1 ? args.slice(1) : ["dev", "-p", "3000"];

const child = spawn(command, commandArgs, {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 0));
child.on("signal", (signal) => process.kill(-child.pid, signal));
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));