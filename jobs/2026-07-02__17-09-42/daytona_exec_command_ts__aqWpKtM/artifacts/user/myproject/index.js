// Daytona sandbox shell command execution program.
//
// Reads the per-run identifier from /logs/artifacts/run-id, creates a fresh
// Daytona sandbox, captures the output of a few diagnostic commands, writes
// the captured stdout into a local log file with labelled prefixes, and
// always tears the sandbox down before exiting.

const fs = require('fs');
const path = require('path');
const { Daytona } = require('@daytona/sdk');

const RUN_ID_FILE = '/logs/artifacts/run-id';
const LOG_FILE = '/home/user/myproject/output.log';

async function main() {
    // 1. Read the run-id from the artifact file on the local task machine.
    const runId = fs.readFileSync(RUN_ID_FILE, 'utf8').trim();
    if (!runId) {
        throw new Error(`Empty run-id in ${RUN_ID_FILE}`);
    }

    const sandboxName = `exec-ts-${runId}`;
    console.log(`[run] using run-id: ${runId}`);
    console.log(`[run] sandbox name will be: ${sandboxName}`);

    // Make sure the local log file exists and starts empty for this run.
    fs.writeFileSync(LOG_FILE, '');

    // 2. Connect to Daytona using the DAYTONA_API_KEY environment variable.
    const daytona = new Daytona();

    let sandbox;
    try {
        // 3. Provision a fresh sandbox. We pass the run-id through as an
        //    environment variable so the sandbox-side `echo` step can see it
        //    and so we can re-use it for command invocations.
        sandbox = await daytona.create({
            name: sandboxName,
            envVars: {
                RUN_ID: runId,
            },
            REDACTEDDeleteInterval: 0,
        });

        const appendLog = (label, payload) => {
            const text = payload == null ? '' : String(payload);
            const normalised = text.endsWith('\n') ? text.slice(0, -1) : text;
            const lines = normalised.split('\n');
            const formatted = lines.map((line) => `${label}: ${line}`).join('\n');
            fs.appendFileSync(LOG_FILE, formatted + '\n');
            console.log(formatted);
        };

        // 4a. cat /etc/os-release
        const osResp = await sandbox.process.executeCommand('cat /etc/os-release');
        appendLog('OS', osResp.result);

        // 4b. node --version
        const nodeResp = await sandbox.process.executeCommand('node --version');
        appendLog('NODE', nodeResp.result);

        // 4c. echo <run-id> -- the sandbox echoes the same run-id that the
        //     local environment read from /logs/artifacts/run-id.
        const echoResp = await sandbox.process.executeCommand(`echo ${runId}`);
        appendLog('ECHO', echoResp.result);
    } finally {
        // 5. Always tear the sandbox down so we don't leak resources.
        if (sandbox) {
            try {
                await daytona.delete(sandbox);
                console.log(`[run] deleted sandbox: ${sandboxName}`);
            } catch (cleanupErr) {
                console.error(
                    `[run] failed to delete sandbox ${sandboxName}:`,
                    cleanupErr,
                );
            }
        }
    }

    console.log('[run] done');
}

main().catch((err) => {
    console.error('[run] fatal error:', err);
    process.exit(1);
});
