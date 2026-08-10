#!/usr/bin/env node
'use strict';

const {
  createSequelize,
  defineModels,
  ensureSchema,
  configureConnection,
} = require('./db');
const { getTransitionTable, isValidStatus } = require('./transitions');
const {
  createOrder,
  transitionOrder,
  getOrderWithHistory,
} = require('./orderService');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i += 1;
      }
    }
  }
  return args;
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

async function main() {
  const [subcommand, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);

  if (!subcommand) {
    fail('Usage: node cli.js <subcommand> --db <path> [options]');
    return;
  }

  if (!args.db || typeof args.db !== 'string') {
    fail('Missing required --db <path> argument.');
    return;
  }

  const sequelize = createSequelize(args.db);
  let exitCode = 0;

  try {
    await configureConnection(sequelize);
    await ensureSchema(sequelize);
    const models = defineModels(sequelize);

    switch (subcommand) {
      case 'init': {
        printJson({ ok: true });
        exitCode = 0;
        break;
      }

      case 'create': {
        const result = await createOrder(sequelize, models);
        printJson(result);
        exitCode = 0;
        break;
      }

      case 'transition': {
        if (args.id === undefined || args.to === undefined) {
          fail('Usage: node cli.js transition --db <path> --id <number> --to <status>');
          exitCode = 1;
          break;
        }
        const id = Number.parseInt(args.id, 10);
        const to = String(args.to);

        if (!Number.isInteger(id)) {
          fail(`Invalid --id value: ${args.id}`);
          exitCode = 1;
          break;
        }
        if (!isValidStatus(to)) {
          // Not a recognized status at all: still surface an illegal
          // transition result rather than a generic error, per spec this
          // counts as an illegal transition attempt.
          const order = await models.Order.findByPk(id);
          if (!order) {
            printJson({ ok: false, error: 'NOT_FOUND', id });
            exitCode = 4;
            break;
          }
          printJson({ ok: false, error: 'ILLEGAL_TRANSITION', id, from: order.status, to });
          exitCode = 3;
          break;
        }

        const result = await transitionOrder(sequelize, models, id, to);
        printJson(result);
        if (result.ok) {
          exitCode = 0;
        } else if (result.error === 'NOT_FOUND') {
          exitCode = 4;
        } else {
          exitCode = 3;
        }
        break;
      }

      case 'show': {
        if (args.id === undefined) {
          fail('Usage: node cli.js show --db <path> --id <number>');
          exitCode = 1;
          break;
        }
        const id = Number.parseInt(args.id, 10);
        if (!Number.isInteger(id)) {
          fail(`Invalid --id value: ${args.id}`);
          exitCode = 1;
          break;
        }

        const result = await getOrderWithHistory(sequelize, models, id);
        if (!result) {
          printJson({ ok: false, error: 'NOT_FOUND', id });
          exitCode = 4;
        } else {
          printJson(result);
          exitCode = 0;
        }
        break;
      }

      case 'transitions': {
        printJson(getTransitionTable());
        exitCode = 0;
        break;
      }

      default: {
        fail(`Unknown subcommand: ${subcommand}`);
        exitCode = 1;
      }
    }
  } catch (err) {
    process.stderr.write(`${err && err.stack ? err.stack : String(err)}\n`);
    exitCode = 1;
  } finally {
    await sequelize.close();
  }

  process.exitCode = exitCode;
}

main();
