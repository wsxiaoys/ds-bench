import { provisionPool, assignTask, status, teardownPool } from './manager.js';

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    printUsageAndExit();
  }

  const subcommand = args[0];

  try {
    switch (subcommand) {
      case 'provision': {
        if (args.length < 2) {
          console.error('Error: provision subcommand requires N (pool size)');
          process.exit(1);
        }
        const n = parseInt(args[1], 10);
        if (isNaN(n) || n <= 0) {
          console.error(`Error: N must be a positive integer, got "${args[1]}"`);
          process.exit(1);
        }
        await provisionPool(n);
        break;
      }
      case 'assign-task': {
        if (args.length < 3) {
          console.error('Error: assign-task subcommand requires <agent-index> and <text>');
          process.exit(1);
        }
        const agentIndex = parseInt(args[1], 10);
        if (isNaN(agentIndex) || agentIndex <= 0) {
          console.error(`Error: agent-index must be a positive integer, got "${args[1]}"`);
          process.exit(1);
        }
        const text = args[2];
        await assignTask(agentIndex, text);
        break;
      }
      case 'status': {
        await status();
        break;
      }
      case 'teardown': {
        await teardownPool();
        break;
      }
      default: {
        console.error(`Error: Unknown subcommand "${subcommand}"`);
        printUsageAndExit();
      }
    }
  } catch (error: any) {
    console.error(`Error: ${error.message || error}`);
    process.exit(1);
  }
}

function printUsageAndExit() {
  console.error('Usage:');
  console.error('  npx tsx cli.ts provision <N>');
  console.error('  npx tsx cli.ts assign-task <agent-index> <text>');
  console.error('  npx tsx cli.ts status');
  console.error('  npx tsx cli.ts teardown');
  process.exit(1);
}

main();
