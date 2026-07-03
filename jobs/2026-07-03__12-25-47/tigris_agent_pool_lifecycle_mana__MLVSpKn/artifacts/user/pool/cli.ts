#!/usr/bin/env node
import { provisionPool, assignTask, status, teardownPool } from "./manager.js";

const USAGE = `Usage: cli.ts <subcommand> [args...]

Subcommands:
  provision <N>          Provision N workspaces concurrently.
  assign-task <i> <text> Upload task.txt to workspace at 1-based index i.
  status                 Print pool size and bucket names.
  teardown               Tear down every workspace in the pool.
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const subcommand = args[0];

  try {
    switch (subcommand) {
      case "provision": {
        const n = Number(args[1]);
        if (!Number.isInteger(n) || n <= 0) {
          process.stderr.write(`provision requires a positive integer, got ${args[1]}\n`);
          process.exitCode = 1;
          return;
        }
        await provisionPool(n);
        return;
      }
      case "assign-task": {
        const agentIndex = Number(args[1]);
        const text = args[2];
        if (!Number.isInteger(agentIndex) || agentIndex <= 0) {
          process.stderr.write(`assign-task requires a positive integer agent index, got ${args[1]}\n`);
          process.exitCode = 1;
          return;
        }
        if (typeof text !== "string") {
          process.stderr.write(`assign-task requires a text argument\n`);
          process.exitCode = 1;
          return;
        }
        await assignTask(agentIndex, text);
        return;
      }
      case "status": {
        await status();
        return;
      }
      case "teardown": {
        await teardownPool();
        return;
      }
      default: {
        process.stderr.write(`Unknown subcommand: ${subcommand}\n${USAGE}`);
        process.exitCode = 1;
        return;
      }
    }
  } catch (err) {
    process.stderr.write(`Error: ${(err as Error).message ?? String(err)}\n`);
    process.exitCode = 1;
  }
}

main();
