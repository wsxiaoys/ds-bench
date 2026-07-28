#!/usr/bin/env node
"use strict";

const { createSequelize, defineProduct } = require("./lib/db");
const { loadProducts, filterNum, filterStr, filterTag, setKey } = require("./lib/queries");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    }
  }
  return args;
}

function requireArg(args, name, command) {
  if (args[name] === undefined) {
    throw new Error(`Missing required --${name} option for command "${command}".`);
  }
  return args[name];
}

function printJson(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}

async function main() {
  const [, , command, ...rest] = process.argv;
  const args = parseArgs(rest);
  const dbPath = args.db || "./data.sqlite";

  if (!command) {
    throw new Error(
      "Usage: node cli.js <load|filter-num|filter-str|filter-tag|set-key> --db <path> [options]"
    );
  }

  const sequelize = createSequelize(dbPath);
  const Product = defineProduct(sequelize);

  try {
    switch (command) {
      case "load": {
        const file = requireArg(args, "file", command);
        await loadProducts(sequelize, Product, file);
        break;
      }

      case "filter-num": {
        const dotPath = requireArg(args, "path", command);
        const op = requireArg(args, "op", command);
        const value = requireArg(args, "value", command);
        const results = await filterNum(sequelize, dotPath, op, value);
        printJson(results);
        break;
      }

      case "filter-str": {
        const dotPath = requireArg(args, "path", command);
        const value = requireArg(args, "value", command);
        const results = await filterStr(sequelize, dotPath, value);
        printJson(results);
        break;
      }

      case "filter-tag": {
        const dotPath = requireArg(args, "path", command);
        const value = requireArg(args, "value", command);
        const results = await filterTag(sequelize, dotPath, value);
        printJson(results);
        break;
      }

      case "set-key": {
        const id = requireArg(args, "id", command);
        const dotPath = requireArg(args, "path", command);
        const jsonLiteral = requireArg(args, "json", command);
        const updated = await setKey(sequelize, Number(id), dotPath, jsonLiteral);
        if (!updated) {
          throw new Error(`No product found with id ${id}.`);
        }
        printJson(updated);
        break;
      }

      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } finally {
    await sequelize.close();
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  }
);
