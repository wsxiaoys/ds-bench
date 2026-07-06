import { Daytona, Image } from '@daytonaio/sdk';
import * as fs from 'fs';

async function main() {
  const runId = fs.readFileSync('/logs/artifacts/run-id', 'utf-8').trim();
  const sandboxName = `decl-ts-${runId}`;

  const daytona = new Daytona({ apiKey: process.env.DAYTONA_API_KEY });

  const image = Image.debianSlim('3.12').pipInstall(['flask', 'click']);

  let sandbox: any = null;
  try {
    console.log(`Creating sandbox: ${sandboxName}`);
    sandbox = await daytona.create({ name: sandboxName, image }, { timeout: 0 });
    console.log(`Sandbox created: ${sandbox.id}`);

    const cmd = `python3 -c "import flask, click; print('flask', flask.__version__); print('click', click.__version__)"`;
    console.log(`Executing command: ${cmd}`);
    const response = await sandbox.process.executeCommand(cmd);
    console.log(`Exit code: ${response.exitCode}`);
    console.log(`Result:\n${response.result}`);

    // Filter to keep only the lines produced by print() calls (the actual stdout)
    // The deprecation warnings are stderr from Python's warnings module
    const stdoutLines = response.result
      .split('\n')
      .filter((line: string) => line.startsWith('flask ') || line.startsWith('click '));
    const stdoutOutput = stdoutLines.join('\n') + '\n';
    console.log(`Filtered stdout:\n${stdoutOutput}`);

    const outputPath = '/home/user/myproject/output.log';
    fs.writeFileSync(outputPath, stdoutOutput, 'utf-8');
    console.log(`Wrote output to ${outputPath}`);
  } finally {
    if (sandbox) {
      try {
        console.log(`Deleting sandbox: ${sandbox.id}`);
        await daytona.delete(sandbox, 0);
        console.log('Sandbox deleted.');
      } catch (err) {
        console.error('Failed to delete sandbox:', err);
      }
    }
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
