#!/usr/bin/env node
import {
  provisionPool,
  assignTask,
  status,
  teardownPool,
  PoolError,
} from './manager.js';

function usage(): never {
  process.stderr.write(
    'usage: cli.ts <provision <N> | assign-task <agent-index> <text> | status | teardown>\n',
  );
  process.exitCode = 1;
  process.exit(process.exitCode);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const [cmd, ...rest] = argv;

  try {
    switch (cmd) {
      case 'provision': {
        if (rest.length !== 1) usage();
        const n = Number(rest[0]);
        if (!Number.isInteger(n) || n <= 0) {
          process.stderr.write(`provision: N must be a positive integer\n`);
          process.exitCode = 1;
          return;
        }
        await provisionPool(n);
        return;
      }
      case 'assign-task': {
        if (rest.length !== 2) usage();
        const agentIndex = Number(rest[0]);
        if (!Number.isInteger(agentIndex) || agentIndex < 1) {
          process.stderr.write(`assign-task: agent index must be a positive integer\n`);
          process.exitCode = 1;
          return;
        }
        await assignTask(agentIndex, rest[1]);
        return;
      }
      case 'status': {
        await status();
        return;
      }
      case 'teardown': {
        const result = await teardownPool();
        if (!result.ok) {
          process.exitCode = 1;
        }
        return;
      }
      default:
        usage();
    }
  } catch (err: any) {
    const msg = err instanceof PoolError ? err.message : err?.message ?? String(err);
    process.stderr.write(`${msg}\n`);
    process.exitCode = err instanceof PoolError ? err.status : 1;
  }
}

main();