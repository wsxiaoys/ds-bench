const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'concurrency_test.db');

// Clean up previous test DB
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

// 1. Init
console.log('Initializing DB...');
execSync(`node cli.js init --db ${dbPath}`);

// 2. Create order
console.log('Creating order...');
const createOutput = execSync(`node cli.js create --db ${dbPath}`).toString();
const order = JSON.parse(createOutput);
console.log('Created order:', order);

// 3. Transition to paid
console.log('Transitioning to paid...');
execSync(`node cli.js transition --db ${dbPath} --id ${order.id} --to paid`);

// 4. Run concurrent transitions: one to shipped, one to cancelled
console.log('Running concurrent transitions from paid to shipped and cancelled...');

function runTransition(toStatus) {
  return new Promise((resolve) => {
    exec(`node cli.js transition --db ${dbPath} --id ${order.id} --to ${toStatus}`, (error, stdout, stderr) => {
      resolve({
        toStatus,
        code: error ? error.code : 0,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });
  });
}

async function run() {
  const results = await Promise.all([
    runTransition('shipped'),
    runTransition('cancelled')
  ]);

  console.log('Results:', results);

  // One should succeed (exit code 0) and the other should fail (exit code 3)
  const successes = results.filter(r => r.code === 0);
  const failures = results.filter(r => r.code === 3);

  console.log(`Successes: ${successes.length}`);
  console.log(`Failures: ${failures.length}`);

  if (successes.length === 1 && failures.length === 1) {
    console.log('PASS: Exactly one transition succeeded, and the other failed with exit code 3!');
  } else {
    console.error('FAIL: Concurrency constraint violated!');
    process.exit(1);
  }

  // Show order status and history
  const showOutput = execSync(`node cli.js show --db ${dbPath} --id ${order.id}`).toString();
  console.log('Final Order State:', showOutput);
  
  // Clean up
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
}

run();
