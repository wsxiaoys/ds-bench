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
        throw new Error('ZEALT_RUN_ID is not set');
    }
    const apiKey = process.env.DAYTONA_API_KEY;
    if (!apiKey) {
        throw new Error('DAYTONA_API_KEY is not set');
    }
    const daytona = new sdk_1.Daytona({
        apiKey,
        serverUrl: 'REDACTED',
    });
    const sandboxName = `git-ts-${runId}`;
    let sandbox;
    try {
        sandbox = await daytona.create({
            name: sandboxName,
            image: 'ubuntu:22.04'
        });
        try {
            await sandbox.waitUntilStarted();
        }
        catch (e) {
            console.log('waitUntilStarted error or already started', e);
        }
        const clonePath = '/home/daytona/spoon-knife';
        await sandbox.process.executeCommand('mkdir -p /home/daytona');
        await sandbox.git.clone('https://github.com/octocat/Spoon-Knife', clonePath);
        const status = await sandbox.git.status(clonePath);
        const branchName = status.currentBranch;
        const lsResponse = await sandbox.process.executeCommand(`ls ${clonePath}`);
        const filesText = lsResponse.result || '';
        const files = filesText.split(/\s+/).filter(f => f.trim().length > 0);
        const filesCsv = files.join(', ');
        const outputLog = '/home/user/myproject/output.log';
        fs.writeFileSync(outputLog, `Branch: ${branchName}\nFiles: ${filesCsv}\n`);
    }
    catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
    finally {
        if (sandbox) {
            try {
                await daytona.delete(sandbox);
            }
            catch (delErr) {
                console.error('Error deleting sandbox:', delErr);
            }
        }
    }
}
main();
//# sourceMappingURL=index.js.map