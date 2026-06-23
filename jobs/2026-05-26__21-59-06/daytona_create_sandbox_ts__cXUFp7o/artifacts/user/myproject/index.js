const { Daytona } = require('@daytonaio/sdk');
const fs = require('fs');

async function main() {
    const runId = process.env.ZEALT_RUN_ID;
    if (!runId) {
        console.warn('ZEALT_RUN_ID is not set in the environment.');
    }
    const name = `create-sandbox-ts-${runId}`;
    
    console.log(`Initializing Daytona client...`);
    const daytona = new Daytona();
    
    console.log(`Creating sandbox: ${name}`);
    const sandbox = await daytona.create({
        name: name,
        language: 'typescript'
    });
    
    console.log(`Sandbox created with ID: ${sandbox.id}`);
    
    fs.writeFileSync('/home/user/myproject/output.log', `Sandbox ID: ${sandbox.id}\n`);
    
    console.log(`Deleting sandbox: ${sandbox.id}`);
    await daytona.delete(sandbox);
    console.log(`Sandbox deleted.`);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});