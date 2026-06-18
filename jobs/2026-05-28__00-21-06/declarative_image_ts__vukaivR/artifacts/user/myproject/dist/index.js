"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_1 = require("@daytonaio/sdk");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
async function main() {
    const apiKey = process.env.DAYTONA_API_KEY;
    if (!apiKey) {
        throw new Error('DAYTONA_API_KEY environment variable is not set');
    }
    const runId = process.env.ZEALT_RUN_ID;
    if (!runId) {
        throw new Error('ZEALT_RUN_ID environment variable is not set');
    }
    const sandboxName = `decl-ts-${runId}`;
    // Build the declarative image: Debian Slim with Python 3.12, flask and click installed
    const image = sdk_1.Image.debianSlim('3.12').pipInstall(['flask', 'click']);
    // Initialize the Daytona SDK (uses default API URL: https://app.daytona.io/api)
    const daytona = new sdk_1.Daytona({ apiKey });
    let sandbox = null;
    try {
        console.log(`Creating sandbox "${sandboxName}" from declarative image...`);
        sandbox = await daytona.create({
            name: sandboxName,
            image,
        }, {
            timeout: 0,
            onSnapshotCreateLogs: (chunk) => process.stdout.write(chunk),
        });
        console.log(`Sandbox "${sandboxName}" created successfully.`);
        // Run Python command inside the sandbox to print flask and click versions
        const cmd = `python3 -c "import flask, click; print('flask', flask.__version__); print('click', click.__version__)"`;
        console.log('Executing command in sandbox...');
        const execResult = await sandbox.process.executeCommand(cmd);
        const rawOutput = execResult.result;
        console.log('Raw command output:', rawOutput);
        // Extract only the flask and click version lines (filter out deprecation warnings)
        const lines = rawOutput.split('\n');
        const versionLines = lines.filter((line) => line.startsWith('flask ') || line.startsWith('click '));
        const output = versionLines.join('\n') + '\n';
        console.log('Filtered output:', output);
        // Write the filtered output to the log file on the host
        const logPath = path.join('/home/user/myproject', 'output.log');
        fs.writeFileSync(logPath, output, 'utf-8');
        console.log(`Output written to ${logPath}`);
    }
    finally {
        // Always delete the sandbox, even on errors
        if (sandbox !== null) {
            console.log(`Deleting sandbox "${sandboxName}"...`);
            await daytona.delete(sandbox);
            console.log(`Sandbox "${sandboxName}" deleted.`);
        }
    }
}
main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
