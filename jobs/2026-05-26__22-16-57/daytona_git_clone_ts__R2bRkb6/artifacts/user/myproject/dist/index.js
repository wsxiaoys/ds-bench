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
async function main() {
    const runId = process.env.ZEALT_RUN_ID;
    if (!runId) {
        throw new Error('ZEALT_RUN_ID environment variable is not set');
    }
    const apiKey = process.env.DAYTONA_API_KEY;
    if (!apiKey) {
        throw new Error('DAYTONA_API_KEY environment variable is not set');
    }
    const sandboxName = `git-ts-${runId}`;
    // Initialize Daytona client
    const daytona = new sdk_1.Daytona({
        apiKey: apiKey,
        apiUrl: 'https://app.daytona.io/api'
    });
    let sandbox;
    try {
        // Create sandbox
        console.log(`Creating sandbox: ${sandboxName}`);
        sandbox = await daytona.create({
            name: sandboxName
        });
        // Clone repository
        console.log('Cloning repository...');
        await sandbox.git.clone('https://github.com/octocat/Spoon-Knife', '/home/daytona/spoon-knife');
        // Get git status
        console.log('Getting git status...');
        const status = await sandbox.git.status('/home/daytona/spoon-knife');
        const branchName = status.currentBranch;
        // List files
        console.log('Listing files...');
        const lsResult = await sandbox.process.executeCommand('ls /home/daytona/spoon-knife');
        const filesOutput = lsResult.result;
        const files = filesOutput.trim().split(/\s+/).filter((f) => f.length > 0);
        const fileList = files.join(', ');
        // Write to log file
        const logPath = '/home/user/myproject/output.log';
        const logContent = `Branch: ${branchName}\nFiles: ${fileList}\n`;
        fs.writeFileSync(logPath, logContent);
        console.log(`Log file written to: ${logPath}`);
        console.log(`Branch: ${branchName}`);
        console.log(`Files: ${fileList}`);
    }
    finally {
        // Delete sandbox
        if (sandbox) {
            console.log(`Deleting sandbox: ${sandboxName}`);
            await daytona.delete(sandbox);
        }
    }
}
main().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
