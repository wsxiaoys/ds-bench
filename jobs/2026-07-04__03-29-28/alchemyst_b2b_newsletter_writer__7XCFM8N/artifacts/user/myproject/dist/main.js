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
const minimist_1 = __importDefault(require("minimist"));
// ---------------------------------------------------------------------------
// Environment & CLI parsing
// ---------------------------------------------------------------------------
const ALCHEMYST_API_KEY = process.env.ALCHEMYST_AI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!ALCHEMYST_API_KEY) {
    console.error("[fatal] ALCHEMYST_AI_API_KEY environment variable is not set.");
    process.exit(1);
}
if (!OPENAI_API_KEY) {
    console.error("[fatal] OPENAI_API_KEY environment variable is not set.");
    process.exit(1);
}
const RUN_ID_PATH = "/logs/artifacts/run-id";
function readRunId() {
    try {
        const raw = fs.readFileSync(RUN_ID_PATH, "utf8");
        const trimmed = raw.trim();
        if (!trimmed) {
            throw new Error(`run-id file at ${RUN_ID_PATH} is empty`);
        }
        return trimmed;
    }
    catch (err) {
        console.error(`[fatal] Unable to read run-id from ${RUN_ID_PATH}: ${err.message}`);
        process.exit(1);
    }
}
const args = (0, minimist_1.default)(process.argv.slice(2));
const topic = args.topic ?? args.t;
if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
    console.error("Usage: node dist/main.js --topic \"<your topic>\"");
    process.exit(1);
}
const cleanTopic = topic.trim();
const runId = readRunId();
const articles = [
    {
        fileName: `b2b_article_ai_agents_${runId}.md`,
        content: "AI agents are REDACTEDnomous software systems built on top of large language models (LLMs). They plan multi-step workflows, call external tools, and reflect on their own outputs. Modern agentic systems combine planning, tool use, memory, and orchestration to REDACTEDmate knowledge work. Keywords: REDACTEDnomous, agentic, planning, tool use, orchestration.",
    },
    {
        fileName: `b2b_article_rag_${runId}.md`,
        content: "Retrieval-Augmented Generation (RAG) augments LLM prompts with snippets retrieved from a vector store. Documents are chunked, embedded, and indexed; at query time a semantic search returns the most relevant chunks and the LLM grounds its answer in that retrieved context.",
    },
    {
        fileName: `b2b_article_vector_db_${runId}.md`,
        content: "Vector databases such as Pinecone, Weaviate, and pgvector store high-dimensional embeddings and support approximate nearest neighbor search. They power semantic retrieval over unstructured text, images, and code by mapping content into a shared embedding space.",
    },
    {
        fileName: `b2b_article_prompt_engineering_${runId}.md`,
        content: "Prompt engineering is the practice of designing effective instructions for large language models. Common techniques include few-shot examples, chain-of-thought reasoning, role prompts, and structured output formats such as JSON. Good prompts reduce hallucinations and improve task performance.",
    },
    {
        fileName: `b2b_article_devops_${runId}.md`,
        content: "DevOps practices accelerate software delivery through continuous integration, continuous deployment, infrastructure-as-code, and observability. Tools such as Kubernetes, Terraform, and GitHub Actions REDACTEDmate provisioning, deployment, and monitoring of production systems.",
    },
];
// ---------------------------------------------------------------------------
// Alchemyst context engine
// ---------------------------------------------------------------------------
const alchemyst = new sdk_1.default({ apiKey: ALCHEMYST_API_KEY });
async function seedArticles() {
    for (const article of articles) {
        const response = await alchemyst.v1.context.add({
            context_type: "resource",
            documents: [{ content: article.content }],
            scope: "internal",
            source: "b2b-newsletter-writer",
            metadata: {
                fileName: article.fileName,
                fileType: "text/markdown",
                groupName: ["b2b-newsletter", runId],
                lastModified: new Date().toISOString(),
                fileSize: Buffer.byteLength(article.content, "utf8"),
            },
        });
        console.log(`  [seed] ${article.fileName} -> context_id=${response.context_id} (success=${response.success})`);
    }
}
async function retrieveContext(query) {
    const response = await alchemyst.v1.context.search({
        minimum_similarity_threshold: 0.25,
        query,
        similarity_threshold: 0.9,
        metadata: "true",
        scope: "internal",
    });
    const contexts = response.contexts ?? [];
    const snippets = [];
    for (const ctx of contexts) {
        if (ctx.content && ctx.content.trim().length > 0) {
            snippets.push(ctx.content.trim());
        }
    }
    return snippets;
}
// ---------------------------------------------------------------------------
// OpenAI composition
// ---------------------------------------------------------------------------
const openai = new openai_1.default({ apiKey: OPENAI_API_KEY });
async function composeNewsletter(topic, snippets) {
    const grounding = snippets.length
        ? snippets.map((s, i) => `(${i + 1}) ${s}`).join("\n\n")
        : "(no external context retrieved)";
    const systemPrompt = [
        "You are a B2B newsletter writer for a knowledgeable executive audience.",
        "You must ground every claim in the numbered context snippets provided below.",
        "Do not invent statistics, company names, or product details that are not in the supplied context.",
        "If the context is thin, stay high-level and framework-oriented rather than fabricating specifics.",
    ].join(" ");
    const userPrompt = [
        `Topic: ${topic}`,
        "",
        "Goal: Write a concise B2B newsletter on the topic above.",
        "",
        "Hard requirements:",
        "- Output MUST be valid Markdown.",
        "- Output MUST contain at least three sections, each starting with a Markdown heading line beginning with '#', '##', or '###'.",
        "- Include exactly these three section headings (in this order):",
        "  ## Why it matters",
        "  ## What's new",
        "  ## What to do next",
        "- Draw every claim from the numbered context snippets. Cite the snippet number in parentheses after each substantive claim, e.g. (1), (2).",
        "- Tone: crisp, professional, B2B executive briefing. No marketing fluff.",
        "",
        "Context snippets:",
        grounding,
    ].join("\n");
    const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.3,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
        ],
    });
    const message = completion.choices?.[0]?.message?.content;
    if (!message || message.trim().length === 0) {
        throw new Error("OpenAI returned an empty completion");
    }
    return message.trim();
}
// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
const OUTPUT_DIR = "/home/user/myproject/output";
const OUTPUT_FILE = path.join(OUTPUT_DIR, "newsletter.md");
function writeNewsletter(markdown) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, markdown + "\n", "utf8");
    console.log(`[done] Newsletter written to ${OUTPUT_FILE}`);
    console.log(`[done] Wrote ${markdown.length} characters`);
}
// ---------------------------------------------------------------------------
// Main flow
// ---------------------------------------------------------------------------
async function main() {
    console.log(`[init] run-id=${runId}`);
    console.log(`[init] topic="${cleanTopic}"`);
    console.log("[step] Seeding article corpus into Alchemyst context engine...");
    await seedArticles();
    console.log("[step] Seeding complete.");
    console.log(`[step] Searching Alchemyst context engine for topic "${cleanTopic}"...`);
    const snippets = await retrieveContext(cleanTopic);
    console.log(`[step] Retrieved ${snippets.length} context snippet(s).`);
    for (const snippet of snippets) {
        const preview = snippet.length > 80 ? snippet.slice(0, 77) + "..." : snippet;
        console.log(`  - ${preview}`);
    }
    console.log("[step] Composing newsletter with OpenAI gpt-4o-mini...");
    const newsletter = await composeNewsletter(cleanTopic, snippets);
    writeNewsletter(newsletter);
}
main().catch((err) => {
    console.error("[fatal] Unhandled error:", err);
    process.exit(1);
});
