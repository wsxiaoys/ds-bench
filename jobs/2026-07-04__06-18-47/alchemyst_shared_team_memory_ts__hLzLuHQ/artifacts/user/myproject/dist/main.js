import { AlchemystAI } from '@alchemystai/sdk';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--user-id') {
            args.userId = argv[++i];
        }
        else if (arg.startsWith('--user-id=')) {
            args.userId = arg.substring('--user-id='.length);
        }
        else if (arg === '--add') {
            args.add = argv[++i];
        }
        else if (arg.startsWith('--add=')) {
            args.add = arg.substring('--add='.length);
        }
        else if (arg === '--query') {
            args.query = argv[++i];
        }
        else if (arg.startsWith('--query=')) {
            args.query = arg.substring('--query='.length);
        }
    }
    return args;
}
function getSessionId() {
    const runIdPath = '/logs/artifacts/run-id';
    const runId = fs.readFileSync(runIdPath, 'utf-8').trim();
    return `team-standup-${runId}`;
}
async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (!args.userId) {
        console.error('Error: --user-id is required. MISSING_PARAMETERS: both userId and sessionId are mandatory for memory operations.');
        process.exit(1);
    }
    if (!args.add && !args.query) {
        console.error('Error: must provide either --add or --query.');
        process.exit(1);
    }
    if (args.add && args.query) {
        console.error('Error: provide only one of --add or --query.');
        process.exit(1);
    }
    const sessionId = getSessionId();
    const apiKey = process.env.ALCHEMYST_AI_API_KEY;
    if (!apiKey) {
        console.error('Error: ALCHEMYST_AI_API_KEY environment variable is required.');
        process.exit(1);
    }
    const client = new AlchemystAI({ apiKey });
    try {
        if (args.add) {
            await client.v1.context.memory.add({
                sessionId: sessionId,
                contents: [
                    {
                        content: args.add,
                        metadata: {
                            messageId: randomUUID(),
                            userId: args.userId,
                        },
                    },
                ],
            });
            console.log(`ADDED: ${args.add}`);
        }
        else if (args.query) {
            const result = await client.v1.context.search({
                query: args.query,
                similarity_threshold: 0.8,
                minimum_similarity_threshold: 0.1,
                user_id: args.userId,
                sessionId: sessionId,
            });
            const contexts = result.contexts || [];
            for (const ctx of contexts) {
                const content = typeof ctx === 'string' ? ctx : (ctx.content || ctx.text || JSON.stringify(ctx));
                console.log(`MEMORY: ${content}`);
            }
        }
    }
    catch (err) {
        console.error('Error:', err?.message || err);
        process.exit(1);
    }
}
main();
