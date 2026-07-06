"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const minimist_1 = __importDefault(require("minimist"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const openai_1 = __importDefault(require("openai"));
const sdk_1 = require("@alchemystai/sdk");
const RUN_ID_PATH = '/logs/artifacts/run-id';
const OUTPUT_DIR = '/home/user/myproject/output';
const OUTPUT_PATH = path_1.default.join(OUTPUT_DIR, 'newsletter.md');
function getRunId() {
    try {
        const runId = fs_1.default.readFileSync(RUN_ID_PATH, 'utf8').trim();
        if (!runId) {
            throw new Error('run-id is empty');
        }
        return runId;
    }
    catch (err) {
        throw new Error('Failed to read run-id from ' + RUN_ID_PATH + ': ' + err.message);
    }
}
function buildArticles(runId) {
    return [
        {
            file_name: 'b2b_article_ai_agents_' + runId + '.md',
            content: 'AI agents are REDACTEDnomous software systems built on top of large language models (LLMs). They plan multi-step workflows, call external tools, and reflect on their own outputs. Modern agentic systems combine planning, tool use, memory, and orchestration to REDACTEDmate knowledge work. Keywords: REDACTEDnomous, agentic, planning, tool use, orchestration.',
        },
        {
            file_name: 'b2b_article_rag_' + runId + '.md',
            content: 'Retrieval-Augmented Generation (RAG) augments LLM prompts with snippets retrieved from a vector store. Documents are chunked, embedded, and indexed; at query time a semantic search returns the most relevant chunks and the LLM grounds its answer in that retrieved context.',
        },
        {
            file_name: 'b2b_article_vector_db_' + runId + '.md',
            content: 'Vector databases such as Pinecone, Weaviate, and pgvector store high-dimensional embeddings and support approximate nearest neighbor search. They power semantic retrieval over unstructured text, images, and code by mapping content into a shared embedding space.',
        },
        {
            file_name: 'b2b_article_prompt_engineering_' + runId + '.md',
            content: 'Prompt engineering is the practice of designing effective instructions for large language models. Common techniques include few-shot examples, chain-of-thought reasoning, role prompts, and structured output formats such as JSON. Good prompts reduce hallucinations and improve task performance.',
        },
        {
            file_name: 'b2b_article_devops_' + runId + '.md',
            content: 'DevOps practices accelerate software delivery through continuous integration, continuous deployment, infrastructure-as-code, and observability. Tools such as Kubernetes, Terraform, and GitHub Actions REDACTEDmate provisioning, deployment, and monitoring of production systems.',
        },
    ];
}
async function seedArticles(client, articles, source) {
    // Per spec, ingest the five articles into the context engine. Each
    // article's metadata.file_name is namespaced with the run-id so
    // concurrent runs do not collide. We seed each article in its own
    // add() call so that every document can carry its own metadata.
    for (const article of articles) {
        await client.v1.context.add({
            documents: [
                {
                    content: article.content,
                    file_name: article.file_name,
                },
            ],
            context_type: 'resource',
            scope: 'internal',
            source,
            metadata: {
                file_name: article.file_name,
                fileName: article.file_name,
                fileSize: Buffer.byteLength(article.content, 'utf8'),
                fileType: 'text/markdown',
                groupName: ['b2b-newsletter', 'research'],
                lastModified: new Date().toISOString(),
            },
        });
    }
}
async function searchContext(client, topic) {
    const result = await client.v1.context.search({
        query: topic,
        scope: 'internal',
        similarity_threshold: 0.8,
        minimum_similarity_threshold: 0.0,
        mode: 'standard',
    });
    const contexts = (Array.isArray(result?.contexts) && result.contexts) ||
        (Array.isArray(result?.data) && result.data) ||
        (Array.isArray(result?.results) && result.results) ||
        [];
    return contexts
        .map((c) => String(c.content ?? c.text ?? ''))
        .filter((s) => s.trim().length > 0);
}
async function generateNewsletter(topic, grounding) {
    const openai = new openai_1.default({ apiKey: process.env.OPENAI_API_KEY });
    const systemPrompt = 'You are a B2B newsletter writer. Produce concise, professional newsletters grounded in the supplied research context. Always output valid Markdown.';
    const userPrompt = 'Write a short B2B newsletter on the topic: "' + topic + '".\n\n' +
        'Use only the following research context as factual grounding. Do not invent facts beyond what is provided.\n\n' +
        '=== RESEARCH CONTEXT ===\n' + grounding + '\n=== END CONTEXT ===\n\n' +
        'Requirements:\n' +
        '- Output MUST be valid Markdown.\n' +
        '- The newsletter MUST contain at least three sections, each introduced by a Markdown heading line (starting with #, ##, or ###).\n' +
        '- Include at least these three sections (you may add more):\n' +
        '  ## Why it matters\n' +
        "  ## What's new\n" +
        '  ## What to do next\n' +
        '- Keep it concise (roughly 250-500 words total).\n' +
        '- Address a B2B audience (decision-makers, engineering leaders).\n' +
        '- Reference concrete details drawn from the research context.';
    const completion = await openai.chat.completions.create({
        model: 'MiniMax-M3',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
    });
    const text = completion.choices?.[0]?.message?.content ?? '';
    return text;
}
async function main() {
    const argv = (0, minimist_1.default)(process.argv.slice(2));
    const topic = argv.topic || argv.t;
    if (!topic || typeof topic !== 'string') {
        console.error('Usage: node dist/main.js --topic "<topic>"');
        process.exit(1);
    }
    const alchemystKey = process.env.ALCHEMYST_AI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!alchemystKey) {
        console.error('Missing ALCHEMYST_AI_API_KEY environment variable.');
        process.exit(1);
    }
    if (!openaiKey) {
        console.error('Missing OPENAI_API_KEY environment variable.');
        process.exit(1);
    }
    const runId = getRunId();
    console.log('[newsletter] Using run-id: ' + runId);
    console.log('[newsletter] Topic: ' + topic);
    const alchemyst = new sdk_1.AlchemystAI({ apiKey: alchemystKey });
    const source = 'b2b-newsletter-writer-' + runId;
    // 1) Seed articles
    const articles = buildArticles(runId);
    console.log('[newsletter] Seeding ' + articles.length + ' articles into context engine...');
    try {
        await seedArticles(alchemyst, articles, source);
        console.log('[newsletter] Seeding complete.');
    }
    catch (err) {
        console.error('[newsletter] Failed to seed articles: ' + err.message);
        throw err;
    }
    // 2) Search context
    console.log('[newsletter] Searching context engine...');
    const contexts = await searchContext(alchemyst, topic);
    console.log('[newsletter] Retrieved ' + contexts.length + ' context snippet(s).');
    const grounding = contexts.join('\n\n');
    if (!grounding.trim()) {
        console.warn('[newsletter] Warning: no grounding context was retrieved; continuing anyway.');
    }
    // 3) Generate newsletter
    console.log('[newsletter] Generating newsletter with OpenAI...');
    const newsletter = await generateNewsletter(topic, grounding);
    if (!newsletter.trim()) {
        throw new Error('OpenAI returned empty content.');
    }
    // 4) Persist
    fs_1.default.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs_1.default.writeFileSync(OUTPUT_PATH, newsletter, 'utf8');
    console.log('[newsletter] Wrote newsletter to ' + OUTPUT_PATH);
}
main().catch((err) => {
    console.error('[newsletter] Fatal error:', err);
    process.exit(1);
});
