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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const sdk_1 = __importDefault(require("@alchemystai/sdk"));
const openai_1 = __importDefault(require("openai"));
const ARTICLES = [
    {
        content: 'AI agents are REDACTEDnomous software systems built on top of large language models (LLMs). They plan multi-step workflows, call external tools, and reflect on their own outputs. Modern agentic systems combine planning, tool use, memory, and orchestration to REDACTEDmate knowledge work. Keywords: REDACTEDnomous, agentic, planning, tool use, orchestration.',
    },
    {
        content: 'Retrieval-Augmented Generation (RAG) augments LLM prompts with snippets retrieved from a vector store. Documents are chunked, embedded, and indexed; at query time a semantic search returns the most relevant chunks and the LLM grounds its answer in that retrieved context.',
    },
    {
        content: 'Vector databases such as Pinecone, Weaviate, and pgvector store high-dimensional embeddings and support approximate nearest neighbor search. They power semantic retrieval over unstructured text, images, and code by mapping content into a shared embedding space.',
    },
    {
        content: 'Prompt engineering is the practice of designing effective instructions for large language models. Common techniques include few-shot examples, chain-of-thought reasoning, role prompts, and structured output formats such as JSON. Good prompts reduce hallucinations and improve task performance.',
    },
    {
        content: 'DevOps practices accelerate software delivery through continuous integration, continuous deployment, infrastructure-as-code, and observability. Tools such as Kubernetes, Terraform, and GitHub Actions REDACTEDmate provisioning, deployment, and monitoring of production systems.',
    },
];
function getRunId() {
    const runIdPath = '/logs/artifacts/run-id';
    const trimmed = fs.readFileSync(runIdPath, 'utf8').trim();
    if (!trimmed) {
        throw new Error(`Run id file ${runIdPath} is empty`);
    }
    return trimmed;
}
function parseArgs(argv) {
    const args = argv.slice(2);
    let topic;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--topic') {
            const next = args[i + 1];
            if (next !== undefined) {
                topic = next;
                i++;
            }
        }
        else if (arg.startsWith('--topic=')) {
            topic = arg.slice('--topic='.length);
        }
    }
    if (!topic || topic.length === 0) {
        throw new Error('Missing required --topic <string> argument');
    }
    return { topic };
}
async function seedArticles(client, runId) {
    const slugs = [
        'b2b_article_ai_agents',
        'b2b_article_rag',
        'b2b_article_vector_db',
        'b2b_article_prompt_engineering',
        'b2b_article_devops',
    ];
    for (let idx = 0; idx < ARTICLES.length; idx++) {
        const article = ARTICLES[idx];
        const slug = slugs[idx];
        const fileName = `${slug}_${runId}.md`;
        await client.v1.context.add({
            context_type: 'resource',
            scope: 'internal',
            source: `b2b-newsletter-writer:${runId}`,
            documents: [{ content: article.content }],
            metadata: {
                fileName,
                fileType: 'text/markdown',
                groupName: ['b2b-newsletter-writer'],
                lastModified: new Date().toISOString(),
                fileSize: Buffer.byteLength(article.content, 'utf8'),
            },
        });
    }
}
async function retrieveContext(client, topic) {
    const response = await client.v1.context.search({
        minimum_similarity_threshold: 0.1,
        similarity_threshold: 0.9,
        query: topic,
        scope: 'internal',
    });
    const contexts = response.contexts ?? [];
    const snippets = contexts
        .map((c) => c.content)
        .filter((c) => typeof c === 'string' && c.length > 0);
    if (snippets.length === 0) {
        return '(No relevant context retrieved.)';
    }
    return snippets.join('\n\n---\n\n');
}
async function composeNewsletter(openai, topic, grounding) {
    const systemPrompt = 'You are a B2B newsletter writer. Always respond in Markdown. The newsletter must contain at least three sections, each introduced by a Markdown heading (a line starting with #, ##, or ###). Ground every claim in the supplied CONTEXT block. Do not invent facts beyond the supplied context.';
    const userPrompt = `Topic: ${topic}\n\nCONTEXT:\n${grounding}\n\nWrite a short B2B newsletter on the topic above. Use at least three Markdown headings (e.g. ## Why it matters, ## What's new, ## What to do next). Keep it concise and grounded in the CONTEXT provided.`;
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
    });
    const output = response.choices[0]?.message?.content;
    if (!output) {
        throw new Error('OpenAI returned an empty completion');
    }
    return output;
}
async function main() {
    const { topic } = parseArgs(process.argv);
    const runId = getRunId();
    const alchemystApiKey = process.env.ALCHEMYST_AI_API_KEY;
    if (!alchemystApiKey) {
        throw new Error('ALCHEMYST_AI_API_KEY environment variable is required');
    }
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
        throw new Error('OPENAI_API_KEY environment variable is required');
    }
    const client = new sdk_1.default({ apiKey: alchemystApiKey });
    const openai = new openai_1.default({ apiKey: openaiApiKey });
    await seedArticles(client, runId);
    const grounding = await retrieveContext(client, topic);
    const newsletter = await composeNewsletter(openai, topic, grounding);
    const outputDir = '/home/user/myproject/output';
    fs.mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, 'newsletter.md');
    fs.writeFileSync(outputPath, newsletter, 'utf8');
    console.log(`Wrote newsletter (${newsletter.length} bytes) to ${outputPath}`);
}
main().catch((err) => {
    console.error(err instanceof Error ? err.stack || err.message : String(err));
    process.exit(1);
});
