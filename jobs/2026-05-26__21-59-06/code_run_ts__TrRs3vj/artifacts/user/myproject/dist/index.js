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
    const runId = process.env.ZEALT_RUN_ID || 'default';
    const sandboxName = `code-run-ts-${runId}`;
    const daytona = new sdk_1.Daytona();
    let sandbox;
    try {
        sandbox = await daytona.create({
            language: 'typescript',
            name: sandboxName,
            labels: { name: sandboxName }
        });
        const snippet = `
function factorial(n: number): number {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}
console.log(factorial(6));
        `;
        const response = await sandbox.process.codeRun(snippet);
        if (response.exitCode !== 0) {
            console.error('Execution failed with exit code:', response.exitCode);
            process.exit(response.exitCode);
        }
        let resultValue = (response.result || '').trim();
        const lines = resultValue.split('\n').map(l => l.trim());
        const intLine = lines.find(l => /^\d+$/.test(l));
        if (intLine) {
            resultValue = intLine;
        }
        const logLine = `Factorial: ${resultValue}\n`;
        fs.writeFileSync('/home/user/myproject/output.log', logLine);
    }
    catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
    finally {
        if (sandbox) {
            await daytona.delete(sandbox);
        }
    }
}
main();
