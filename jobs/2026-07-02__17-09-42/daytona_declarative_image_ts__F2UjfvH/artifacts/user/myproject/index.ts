import { Daytona, Image } from '@daytonaio/sdk';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const PROJECT_DIR = '/home/user/myproject';
const RUN_ID_PATH = '/logs/artifacts/run-id';
const OUTPUT_LOG = `${PROJECT_DIR}/output.log`;

async function main(): Promise<void> {
  // Read run-id for sandbox name suffix
  const runId = readFileSync(RUN_ID_PATH, 'utf8').trim();
  if (!runId) {
    throw new Error(`run-id is empty in ${RUN_ID_PATH}`);
  }
  const sandboxName = `decl-ts-${runId}`;
  console.log(`[run] using run-id="${runId}" -> sandbox name "${sandboxName}"`);

  // Build declarative image: Debian slim Python 3.12 with flask + click
  const image = Image.debianSlim('3.12').pipInstall(['flask', 'click']);
  console.log('[run] declarative image built');

  // Initialize Daytona SDK with the real SaaS endpoint
  const daytona = new Daytona({ apiKey: process.env.DAYTONA_API_KEY });

  // Always delete the sandbox, even on errors
  let sandbox: Awaited<ReturnType<Daytona['create']>> | undefined;
  try {
    console.log('[run] creating sandbox (this may take a while for snapshot build)...');
    sandbox = await daytona.create(
      {
        name: sandboxName,
        image,
        language: 'python',
      },
      // Snapshot build can take a while -> no timeout (0)
      { timeout: 0 },
    );
    console.log(`[run] sandbox created: ${sandbox.id}`);

    // Run the Python version check command inside the sandbox
    const cmd =
      'python3 -c "import flask, click; print(\'flask\', flask.__version__); print(\'click\', click.__version__)"';
    console.log(`[run] executing: ${cmd}`);
    const response = await sandbox.process.executeCommand(cmd);

    const stdout = response.result ?? '';
    console.log('[run] ---- stdout begin ----');
    console.log(stdout);
    console.log('[run] ---- stdout end ----');

    // Make sure parent dir exists, then write the log verbatim
    mkdirSync(dirname(OUTPUT_LOG), { recursive: true });
    writeFileSync(OUTPUT_LOG, stdout);
    console.log(`[run] wrote ${OUTPUT_LOG}`);
  } finally {
    if (sandbox) {
      try {
        console.log('[run] deleting sandbox...');
        await daytona.delete(sandbox);
        console.log('[run] sandbox deleted');
      } catch (err) {
        console.error('[run] failed to delete sandbox:', err);
      }
    }
  }
}

main().catch((err) => {
  console.error('[run] fatal:', err);
  process.exitCode = 1;
});
