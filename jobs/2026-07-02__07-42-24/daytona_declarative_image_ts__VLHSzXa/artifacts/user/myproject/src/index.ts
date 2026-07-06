import fs from 'fs';
import { Daytona, Image } from '@daytonaio/sdk';

async function main() {
  const runIdPath = '/logs/artifacts/run-id';
  if (!fs.existsSync(runIdPath)) {
    console.error(`Run ID file not found at ${runIdPath}`);
    process.exit(1);
  }
  const runId = fs.readFileSync(runIdPath, 'utf-8').trim();
  const sandboxName = `decl-ts-${runId}`;
  console.log(`Using run-id: ${runId}`);
  console.log(`Sandbox name: ${sandboxName}`);

  const apiKey = process.env.DAYTONA_API_KEY;
  if (!apiKey) {
    console.error('DAYTONA_API_KEY environment variable is not set');
    process.exit(1);
  }

  // Initialize SDK
  const daytona = new Daytona({ apiKey });

  // Define declarative image
  console.log('Defining declarative image...');
  const image = Image.debianSlim('3.12').pipInstall(['flask', 'click']);

  let sandbox;
  try {
    // Create sandbox
    console.log(`Creating sandbox '${sandboxName}' from declarative image...`);
    sandbox = await daytona.create({
      name: sandboxName,
      image,
    }, {
      timeout: 0, // Generous timeout (no timeout)
    });
    console.log(`Sandbox '${sandboxName}' created successfully. ID: ${sandbox.id}`);

    // Run Python command inside sandbox with PYTHONWARNINGS=ignore to suppress deprecation warnings
    const pythonCommand = `python3 -c "import flask, click; print('flask', flask.__version__); print('click', click.__version__)"`;
    console.log(`Executing command inside sandbox: ${pythonCommand}`);
    
    const response = await sandbox.process.executeCommand(
      pythonCommand,
      undefined,
      { PYTHONWARNINGS: 'ignore' }
    );
    console.log(`Command exit code: ${response.exitCode}`);
    console.log(`Command output:\n${response.result}`);

    // Write output to /home/user/myproject/output.log
    const logPath = '/home/user/myproject/output.log';
    console.log(`Writing output verbatim to ${logPath}...`);
    fs.writeFileSync(logPath, response.result);
    console.log('Output written successfully.');

  } catch (error) {
    console.error('An error occurred during task execution:', error);
  } finally {
    if (sandbox) {
      try {
        console.log(`Deleting sandbox '${sandboxName}'...`);
        await daytona.delete(sandbox);
        console.log(`Sandbox '${sandboxName}' deleted successfully.`);
      } catch (deleteError) {
        console.error('Failed to delete sandbox:', deleteError);
      }
    }
  }
}

main().catch((err) => {
  console.error('Fatal error in main:', err);
  process.exit(1);
});
