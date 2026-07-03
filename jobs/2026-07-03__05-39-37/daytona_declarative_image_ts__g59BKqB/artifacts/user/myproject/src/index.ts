import * as fs from "fs";
import * as path from "path";
import { Daytona, Image } from "@daytonaio/sdk";

/**
 * Build a Daytona sandbox from a declarative Image, run a Python command that
 * prints the installed `flask` and `click` versions, capture the stdout and
 * write it to output.log on the host, then delete the sandbox.
 */
async function main(): Promise<void> {
  const apiKey = process.env.DAYTONA_API_KEY;
  if (!apiKey) {
    throw new Error("DAYTONA_API_KEY environment variable is not set");
  }

  // Read run-id from /logs/artifacts/run-id (trim any trailing whitespace/CR).
  const runIdPath = "/logs/artifacts/run-id";
  const runIdRaw = fs.readFileSync(runIdPath, "utf8");
  const runId = runIdRaw.trim();
  if (!runId) {
    throw new Error(`run-id file at ${runIdPath} is empty`);
  }

  const sandboxName = `decl-ts-${runId}`;
  const outputPath = path.join("/home/user/myproject", "output.log");

  console.log(`Run ID:        ${runId}`);
  console.log(`Sandbox name:  ${sandboxName}`);
  console.log(`Output log:    ${outputPath}`);

  // Build the declarative image: python:3.12 debian slim + flask and click.
  const image = Image.debianSlim("3.12").pipInstall(["flask", "click"]);

  const daytona = new Daytona({ apiKey });

  let sandbox: Awaited<ReturnType<typeof daytona.create>> | undefined;

  try {
    console.log("Creating sandbox from declarative image (this may take a while)...");
    // Pass the Image instance directly; timeout 0 = no timeout (build can be slow).
    sandbox = await daytona.create(
      { image, name: sandboxName },
      { timeout: 0 },
    );

    console.log(`Sandbox created with id: ${sandbox.id}`);

    // Run the Python command inside the sandbox.
    // Redirect stderr to /dev/null so .result contains only the two stdout
    // print lines (Python emits DeprecationWarnings for __version__ on stderr).
    const cmd = `python3 -c "import flask, click; print('flask', flask.__version__); print('click', click.__version__)" 2>/dev/null`;
    console.log(`Executing command: ${cmd}`);

    const response = await sandbox.process.executeCommand(cmd);

    console.log(`Command exit code: ${response.exitCode}`);
    console.log(`Command stdout:\n${response.result}`);

    if (response.exitCode !== 0) {
      throw new Error(
        `Command exited with code ${response.exitCode}. stdout: ${response.result}`,
      );
    }

    // Capture both lines of stdout, in order, one line per print, verbatim.
    // Ensure the output ends with a trailing newline.
    const stdout = response.result;
    const outputContent = stdout.endsWith("\n") ? stdout : stdout + "\n";

    fs.writeFileSync(outputPath, outputContent, "utf8");
    console.log(`Wrote output to ${outputPath}`);
  } finally {
    // Always delete the sandbox, even on errors.
    if (sandbox) {
      try {
        console.log("Deleting sandbox...");
        await daytona.delete(sandbox);
        console.log("Sandbox deleted.");
      } catch (deleteErr) {
        console.error("Failed to delete sandbox:", deleteErr);
      }
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});