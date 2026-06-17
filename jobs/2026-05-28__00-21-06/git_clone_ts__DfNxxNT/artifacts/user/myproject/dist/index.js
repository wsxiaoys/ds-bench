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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const sdk_1 = require("@daytonaio/sdk");
async function main() {
    // Step 1: Read run-id from environment and build the sandbox name
    const runId = process.env.ZEALT_RUN_ID;
    if (!runId) {
        throw new Error('ZEALT_RUN_ID environment variable is not set');
    }
    const sandboxName = `git-ts-${runId}`;
    // Validate API key presence early
    const apiKey = process.env.DAYTONA_API_KEY;
    if (!apiKey) {
        throw new Error('DAYTONA_API_KEY environment variable is not set');
    }
    // Configure the Daytona client
    const daytona = new sdk_1.Daytona({
        apiKey,
        apiUrl: 'https://app.daytona.io/api',
    });
    const clonePath = '/home/daytona/spoon-knife';
    const repoUrl = 'https://github.com/octocat/Spoon-Knife';
    const logFilePath = path.resolve('/home/user/myproject/output.log');
    // Create the sandbox
    console.log(`Creating sandbox: ${sandboxName}`);
    const sandbox = await daytona.create({ name: sandboxName });
    console.log(`Sandbox created with id: ${sandbox.id}`);
    try {
        // Step 2: Clone the repository into the sandbox
        console.log(`Cloning ${repoUrl} into ${clonePath} ...`);
        await sandbox.git.clone(repoUrl, clonePath);
        console.log('Clone completed.');
        // Step 3: Get the git status to retrieve the current branch name
        console.log('Fetching git status ...');
        const gitStatus = await sandbox.git.status(clonePath);
        const branchName = gitStatus.currentBranch ?? 'unknown';
        console.log(`Current branch: ${branchName}`);
        // Step 4: List the files at the root of the cloned repository
        console.log('Listing files in cloned repository ...');
        const lsResponse = await sandbox.process.executeCommand(`ls ${clonePath}`);
        const rawOutput = lsResponse.result ?? '';
        const files = rawOutput
            .split(/\s+/)
            .map((f) => f.trim())
            .filter((f) => f.length > 0);
        const fileList = files.join(', ');
        console.log(`Files: ${fileList}`);
        // Step 5: Write results to the log file on the host machine
        const logContent = `Branch: ${branchName}\nFiles: ${fileList}\n`;
        fs.writeFileSync(logFilePath, logContent, 'utf8');
        console.log(`Results written to ${logFilePath}`);
    }
    finally {
        // Step 6: Delete the sandbox regardless of success or failure
        console.log(`Deleting sandbox: ${sandboxName}`);
        await daytona.delete(sandbox);
        console.log('Sandbox deleted.');
    }
}
main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map