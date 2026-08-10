const { createDatabase, increment } = require('./src/runner');

function parseArgs(args) {
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const parts = arg.slice(2).split('=');
      const key = parts[0];
      let val = parts[1];
      if (val === undefined) {
        if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
          val = args[i + 1];
          i++;
        } else {
          val = true;
        }
      }
      parsed[key] = val;
    } else if (!parsed.command) {
      parsed.command = arg;
    }
  }
  return parsed;
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  
  if (parsed.command === 'init') {
    const dbPath = parsed.db;
    if (!dbPath) {
      console.error('Error: --db <path> is required');
      process.exit(1);
    }
    
    const db = await createDatabase(dbPath);
    await db.sequelize.close();
    process.exit(0);
  } else if (parsed.command === 'run') {
    const dbPath = parsed.db;
    if (!dbPath) {
      console.error('Error: --db <path> is required');
      process.exit(1);
    }
    
    const concurrency = parseInt(parsed.concurrency || '1', 10);
    const maxAttempts = parseInt(parsed['max-attempts'] || '5', 10);
    const baseDelayMs = parseInt(parsed['base-delay-ms'] || '100', 10);
    
    const db = await createDatabase(dbPath);
    
    const promises = [];
    for (let i = 0; i < concurrency; i++) {
      promises.push(increment(db, { maxAttempts, baseDelayMs }));
    }
    
    const results = await Promise.allSettled(promises);
    
    const successes = results.filter(r => r.status === 'fulfilled').length;
    
    // Read the final total from the database
    const counter = await db.Counter.findByPk(1);
    const total = counter ? counter.total : 0;
    
    console.log(JSON.stringify({ successes, total }));
    
    await db.sequelize.close();
    process.exit(0);
  } else {
    console.error('Unknown command. Use "init" or "run".');
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
