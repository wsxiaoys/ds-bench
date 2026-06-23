import { Daytona } from '@daytonaio/sdk';
import * as fs from 'fs';

async function main() {
    const runId = process.env.ZEALT_RUN_ID || 'default';
    const sandboxName = `code-run-ts-${runId}`;
    
    const daytona = new Daytona();

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
        
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    } finally {
        if (sandbox) {
            await daytona.delete(sandbox);
        }
    }
}

main();
