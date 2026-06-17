import { Daytona, Image } from '@daytonaio/sdk';
import * as fs from 'fs';
async function main() {
    const apiKey = process.env.DAYTONA_API_KEY;
    const runId = process.env.ZEALT_RUN_ID;
    if (!apiKey) {
        console.error('DAYTONA_API_KEY is not set');
        process.exit(1);
    }
    if (!runId) {
        console.error('ZEALT_RUN_ID is not set');
        process.exit(1);
    }
    const daytona = new Daytona({
        apiKey: apiKey,
        serverUrl: 'https://app.daytona.io/api'
    });
    const sandboxName = `decl-ts-${runId}`;
    const logFilePath = '/home/user/myproject/output.log';
    let sandbox;
    try {
        console.log(`Creating sandbox: ${sandboxName}...`);
        const image = Image.debianSlim('3.12').pipInstall(['flask', 'click']);
        sandbox = await daytona.create({
            name: sandboxName,
            image: image,
        });
        console.log('Sandbox created. Executing command...');
        const result = await sandbox.process.executeCommand('python3 -c "import flask, click; print(\'flask\', flask.__version__); print(\'click\', click.__version__)"');
        console.log('Command executed. Capturing output...');
        fs.writeFileSync(logFilePath, result.result);
        console.log(`Output written to ${logFilePath}`);
    }
    catch (error) {
        console.error('An error occurred:', error);
    }
    finally {
        if (sandbox) {
            try {
                console.log('Deleting sandbox...');
                await daytona.delete(sandbox);
                console.log('Sandbox deleted.');
            }
            catch (deleteError) {
                console.error('Error deleting sandbox:', deleteError);
            }
        }
    }
}
main();
