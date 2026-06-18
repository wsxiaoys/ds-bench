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
        throw new Error('DAYTONA_API_KEY is not set');
    }
    const runId = process.env.ZEALT_RUN_ID;
    if (!runId) {
        throw new Error('ZEALT_RUN_ID is not set');
    }
    const daytona = new sdk_1.Daytona({ apiKey });
    const sandboxName = `decl-ts-${runId}`;
    const image = sdk_1.Image.debianSlim('3.12').pipInstall(['flask', 'click']);
    console.log(`Creating sandbox ${sandboxName}...`);
    const sandbox = await daytona.create({
        image,
        name: sandboxName,
    }, {
        timeout: 0,
    });
    try {
        console.log(`Executing command...`);
        const cmd = `python3 -c "import flask, click; print('flask', flask.__version__); print('click', click.__version__)"`;
        const response = await sandbox.process.executeCommand(cmd);
        // According to the hint: "read its `.result` (stdout) field"
        // I need to check the exact property name on response. Is it `result` or `code` etc?
        // Let me verify the SDK process.executeCommand return type.
        const output = response.result;
        console.log(`Output: ${output}`);
        const filteredOutput = output
            .split('\n')
            .filter(line => line.startsWith('flask ') || line.startsWith('click '))
            .join('\n');
        const logPath = path.join(__dirname, 'output.log');
        fs.writeFileSync(logPath, filteredOutput + '\n');
        console.log(`Wrote output to ${logPath}`);
    }
    finally {
        console.log(`Deleting sandbox ${sandboxName}...`);
        await daytona.delete(sandbox);
    }
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
