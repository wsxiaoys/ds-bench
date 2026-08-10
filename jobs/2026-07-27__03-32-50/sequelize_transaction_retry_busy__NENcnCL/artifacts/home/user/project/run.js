#!/usr/bin/env node
"use strict";

const path = require("path");
const { createDatabase, increment } = require("./src/runner");

function parseArgs(argv) {
  const args = { _: [] };
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
    } else {
      args._.push(token);
    }
  }
  return args;
}

function parsePositiveInt(value, flagName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`--${flagName} must be a positive integer, got: ${value}`);
  }
  return parsed;
}

function parseNonNegativeInt(value, flagName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`--${flagName} must be a non-negative integer, got: ${value}`);
  }
  return parsed;
}

async function runInit(args) {
  const dbPath = args.db;
  if (!dbPath || dbPath === true) {
    throw new Error('init requires --db "<path>"');
  }

  const db = await createDatabase(path.resolve(dbPath));
  await db.sequelize.close();
}

async function runConcurrentIncrements(args) {
  const dbPath = args.db;
  if (!dbPath || dbPath === true) {
    throw new Error('run requires --db "<path>"');
  }

  const concurrency = parsePositiveInt(args.concurrency, "concurrency");
  const maxAttempts = parsePositiveInt(args["max-attempts"], "max-attempts");
  const baseDelayMs = parseNonNegativeInt(args["base-delay-ms"], "base-delay-ms");

  const db = await createDatabase(path.resolve(dbPath));

  try {
    const jobs = Array.from({ length: concurrency }, () =>
      increment(db, { maxAttempts, baseDelayMs })
    );
    const results = await Promise.allSettled(jobs);

    const successes = results.filter((result) => result.status === "fulfilled").length;

    const counter = await db.Counter.findByPk(1);
    const total = counter ? counter.total : 0;

    process.stdout.write(`${JSON.stringify({ successes, total })}\n`);
  } finally {
    await db.sequelize.close();
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const command = argv[0];
  const args = parseArgs(argv.slice(1));

  switch (command) {
    case "init":
      await runInit(args);
      return;
    case "run":
      await runConcurrentIncrements(args);
      return;
    default:
      throw new Error(`Unknown command "${command}". Expected "init" or "run".`);
  }
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exitCode = 1;
});
