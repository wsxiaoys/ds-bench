const fs = require('fs');
const path = require('path');
const { Daytona } = require('@daytonaio/sdk');

async function main() {
  const runId = fs.readFileSync('/logs/artifacts/run-id', 'utf8').trim();
  const name = `create-sandbox-ts-${runId}`;
  const logPath = '/home/user/myproject/output.log';

  const daytona = new Daytona();

  console.log(`Creating sandbox: ${name}`);
  const sandbox = await daytona.create({
    name,
    language: 'typescript',
  });

  console.log(`Sandbox created: ${sandbox.id}`);
  fs.writeFileSync(logPath, `Sandbox ID: ${sandbox.id}\n`);
  console.log(`Wrote sandbox id to ${logPath}`);

  console.log('Deleting sandbox...');
  await daytona.delete(sandbox);
  console.log('Sandbox deleted.');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
