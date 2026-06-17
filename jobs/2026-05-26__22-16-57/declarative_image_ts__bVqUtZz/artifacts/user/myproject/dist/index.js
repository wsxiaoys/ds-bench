import { Daytona, Image } from '@daytonaio/sdk';
import * as fs from 'fs';
async function main() {
    // Read ZEALT_RUN_ID from environment
    const runId = process.env.ZEALT_RUN_ID;
    if (!runId) {
        throw new Error('ZEALT_RUN_ID environment variable is not set');
    }
    // Create sandbox name
    const sandboxName = `decl-ts-${runId}`;
    console.log(`Creating sandbox: ${sandboxName}`);
    // Initialize Daytona client
    const daytona = new Daytona({
        apiKey: process.env.DAYTONA_API_KEY,
    });
    let sandbox;
    try {
        // Create declarative image with Debian Slim 3.12 and install flask and click
        const image = Image.debianSlim('3.12').pipInstall(['flask', 'click']);
        console.log('Creating sandbox from declarative image...');
        // Create sandbox from the declarative image with no timeout
        sandbox = await daytona.create({
            name: sandboxName,
            image,
        }, { timeout: 0 });
        console.log(`Sandbox created: ${sandbox.id}`);
        // Run Python command to check flask and click versions
        const pythonCommand = `python3 -c "import flask, click; print('flask', flask.__version__); print('click', click.__version__)"`;
        console.log(`Executing command: ${pythonCommand}`);
        const response = await sandbox.process.executeCommand(pythonCommand);
        console.log('Command output:');
        console.log(response.result);
        // Write output to log file
        const outputPath = '/home/user/myproject/output.log';
        fs.writeFileSync(outputPath, response.result);
        console.log(`Output written to: ${outputPath}`);
    }
    finally {
        // Always delete the sandbox
        if (sandbox) {
            console.log(`Deleting sandbox: ${sandbox.id}`);
            await daytona.delete(sandbox);
            console.log('Sandbox deleted successfully');
        }
    }
}
main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
});
