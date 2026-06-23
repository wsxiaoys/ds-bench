const fs = require('fs');
const path = require('path');
const { Daytona } = require('@daytona/sdk');

const logPath = path.join(__dirname, 'output.log');

function normalizeOutput(output) {
  return output.trim().replace(/\r?\n/g, ' ');
}

function appendLine(label, output) {
  const normalized = normalizeOutput(output);
  fs.appendFileSync(logPath, `${label}: ${normalized}\n`, 'utf8');
}

async function main() {
  const runId = process.env.ZEALT_RUN_ID;
  if (!runId) {
    throw new Error('ZEALT_RUN_ID is required');
  }

  const daytona = new Daytona();
  let sandbox;

  try {
    sandbox = await daytona.create({
      name: `exec-ts-${runId}`,
      envVars: {
        ZEALT_RUN_ID: runId,
      },
    });

    const osResult = await sandbox.process.executeCommand('cat /etc/os-release');
    appendLine('OS', osResult.result);

    const nodeResult = await sandbox.process.executeCommand('node --version');
    appendLine('NODE', nodeResult.result);

    const echoResult = await sandbox.process.executeCommand('echo ${ZEALT_RUN_ID}');
    appendLine('ECHO', echoResult.result);
  } finally {
    if (sandbox) {
      await daytona.delete(sandbox);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
