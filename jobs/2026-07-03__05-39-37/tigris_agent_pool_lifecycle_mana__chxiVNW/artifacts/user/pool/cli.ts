import { provisionPool, assignTask, status, teardownPool } from './manager';

/**
 * CLI entrypoint.
 *
 * Usage:
 *   npx tsx cli.ts provision <N>
 *   npx tsx cli.ts assign-task <agent-index> <text>
 *   npx tsx cli.ts status
 *   npx tsx cli.ts teardown
 *
 * Unknown subcommands exit non-zero with a usage message on stderr.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2); // drop node + script path
  const subcommand = args[0];

  switch (subcommand) {
    case 'provision': {
      if (args.length !== 2) {
        process.stderr.write('usage: cli.ts provision <N>\n');
        process.exitCode = 1;
        return;
      }
      const n = Number(args[1]);
      if (!Number.isInteger(n) || n < 0) {
        process.stderr.write(`provision: <N> must be a non-negative integer, got: ${args[1]}\n`);
        process.exitCode = 1;
        return;
      }
      try {
        await provisionPool(n);
      } catch (err: any) {
        process.stderr.write(`provision failed: ${err?.message ?? err}\n`);
        process.exitCode = 1;
      }
      return;
    }

    case 'assign-task': {
      if (args.length < 3) {
        process.stderr.write('usage: cli.ts assign-task <agent-index> <text>\n');
        process.exitCode = 1;
        return;
      }
      const agentIndex = Number(args[1]);
      if (!Number.isInteger(agentIndex)) {
        process.stderr.write(`assign-task: <agent-index> must be an integer, got: ${args[1]}\n`);
        process.exitCode = 1;
        return;
      }
      // The task text is everything after the agent index, joined so a single
      // shell-quoted argument is preserved exactly as provided.
      const text = args.slice(2).join(' ');
      try {
        await assignTask(agentIndex, text);
      } catch (err: any) {
        process.stderr.write(`assign-task failed: ${err?.message ?? err}\n`);
        process.exitCode = 1;
      }
      return;
    }

    case 'status': {
      try {
        await status();
      } catch (err: any) {
        process.stderr.write(`status failed: ${err?.message ?? err}\n`);
        process.exitCode = 1;
      }
      return;
    }

    case 'teardown': {
      try {
        const code = await teardownPool();
        process.exitCode = code;
      } catch (err: any) {
        process.stderr.write(`teardown failed: ${err?.message ?? err}\n`);
        process.exitCode = 1;
      }
      return;
    }

    default: {
      process.stderr.write(
        'usage: cli.ts <provision <N> | assign-task <agent-index> <text> | status | teardown>\n',
      );
      process.exitCode = 1;
    }
  }
}

main();