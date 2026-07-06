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
const sdk_1 = require("@daytonaio/sdk");
const RUN_ID_FILE = '/logs/artifacts/run-id';
const REPO_URL = 'https://github.com/octocat/Spoon-Knife';
const REPO_DIR = '/home/daytona/spoon-knife';
const OUTPUT_LOG = '/home/user/myproject/output.log';
const LS_COMMAND = `ls ${REPO_DIR}`;
async function main() {
    // 1. Read run-id and create a sandbox with the appropriate name.
    const runId = fs.readFileSync(RUN_ID_FILE, 'utf8').trim();
    const sandboxName = `git-ts-${runId}`;
    console.log(`[info] run-id = ${runId}`);
    console.log(`[info] sandbox name = ${sandboxName}`);
    const daytona = new sdk_1.Daytona({
        apiKey: process.env.DAYTONA_API_KEY,
        serverUrl: 'https://app.daytona.io/api',
    });
    const sandbox = await daytona.create({
        name: sandboxName,
        language: 'typescript',
    });
    console.log(`[info] sandbox created: id=${sandbox.id}`);
    try {
        // 2. Clone the repository into the absolute path inside the sandbox.
        console.log(`[info] cloning ${REPO_URL} into ${REPO_DIR}`);
        await sandbox.git.clone(REPO_URL, REPO_DIR);
        // 3. Get the current branch of the cloned repo.
        const gitStatus = await sandbox.git.status(REPO_DIR);
        const branchName = gitStatus.currentBranch;
        console.log(`[info] current branch: ${branchName}`);
        // 4. List the files at the root of the cloned repository.
        const lsResult = await sandbox.process.executeCommand(LS_COMMAND);
        const lsStdout = lsResult.result ?? '';
        console.log(`[info] ls stdout: ${JSON.stringify(lsStdout)}`);
        // 5. Build the file list and write the log file on the host.
        const files = lsStdout
            .split(/[\s,]+/)
            .map((name) => name.trim())
            .filter((name) => name.length > 0);
        const filesLine = `Files: ${files.join(', ')}`;
        const branchLine = `Branch: ${branchName}`;
        const logContent = `${branchLine}\n${filesLine}\n`;
        fs.writeFileSync(OUTPUT_LOG, logContent);
        console.log(`[info] wrote log to ${OUTPUT_LOG}`);
        console.log(logContent);
    }
    finally {
        // 6. Delete the sandbox before exiting, regardless of intermediate failures.
        try {
            console.log(`[info] deleting sandbox ${sandbox.id}`);
            await sandbox.delete();
            console.log('[info] sandbox deleted');
        }
        catch (cleanupErr) {
            console.error(`[warn] failed to delete sandbox: ${cleanupErr}`);
        }
    }
}
main().catch((err) => {
    console.error(`[error] ${err?.stack ?? err}`);
    process.exitCode = 1;
});
