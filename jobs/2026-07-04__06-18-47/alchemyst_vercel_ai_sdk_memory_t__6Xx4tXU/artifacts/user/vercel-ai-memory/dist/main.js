"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ai_1 = require("ai");
const openai_1 = require("@ai-sdk/openai");
const aisdk_1 = require("@alchemystai/aisdk");
function parseArgs(argv) {
    const args = argv.slice(2);
    let phase;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--phase') {
            const next = args[i + 1];
            if (!next) {
                process.stderr.write('Error: --phase requires a value (establish or recall)\n');
                process.exit(2);
            }
            phase = next;
            i++;
        }
        else if (arg.startsWith('--phase=')) {
            phase = arg.slice('--phase='.length);
        }
    }
    if (phase !== 'establish' && phase !== 'recall') {
        process.stderr.write('Error: --phase must be either "establish" or "recall"\n');
        process.exit(2);
    }
    return { phase: phase };
}
function requireEnv(name) {
    const value = process.env[name];
    if (!value || value.trim() === '') {
        process.stderr.write(`Error: required environment variable ${name} is not set\n`);
        process.exit(2);
    }
    return value;
}
async function main() {
    const { phase } = parseArgs(process.argv);
    const alchemystApiKey = requireEnv('ALCHEMYST_AI_API_KEY');
    const openaiApiKey = requireEnv('OPENAI_API_KEY');
    const runId = requireEnv('RUN_ID');
    // Ensure OpenAI key is visible to the provider
    process.env.OPENAI_API_KEY = openaiApiKey;
    const userId = `vercel-memory-user-${runId}`;
    const sessionId = phase === 'establish' ? `establish-${runId}` : `recall-${runId}`;
    const wrappedGenerateText = (0, aisdk_1.withAlchemyst)(ai_1.generateText, { apiKey: alchemystApiKey });
    let promptText;
    if (phase === 'establish') {
        promptText =
            'Please remember this about me: I am vegan and I am allergic to peanuts. Acknowledge that you will remember.';
    }
    else {
        promptText =
            'Based on what you remember about my dietary restrictions, what should I avoid at a dinner party? List the exact dietary label(s) I told you.';
    }
    const result = await wrappedGenerateText({
        model: (0, openai_1.openai)('gpt-4o-mini'),
        prompt: promptText,
        userId,
        sessionId,
    });
    const text = typeof result.text === 'string' ? result.text : await result.text;
    if (text && text.length > 0) {
        process.stdout.write(text + '\n');
    }
    else {
        process.stderr.write('Error: model returned an empty response\n');
        process.exit(1);
    }
}
main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exit(1);
});
//# sourceMappingURL=main.js.map