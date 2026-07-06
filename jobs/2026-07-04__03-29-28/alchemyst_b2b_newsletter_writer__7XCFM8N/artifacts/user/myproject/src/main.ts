import * as fs from "fs";
import * as path from "path";
import AlchemystAI from "@alchemystai/sdk";
import OpenAI from "openai";
import minimist from "minimist";

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

function readRunId(): string {
  try {
    const raw = fs.readFileSync(RUN_ID_PATH, "utf8");
    const trimmed = raw.trim();
    if (!trimmed) {
      throw new Error(`run-id file at ${RUN_ID_PATH} is empty`);
    }
    return trimmed;
  } catch (err) {
    console.error(
      `[fatal] Unable to read run-id from ${RUN_ID_PATH}: ${(err as Error).message}`,
    );
    process.exit(1);
  }
}

const args = minimist(process.argv.slice(2));
const topic: string | undefined = (args.topic as string) ?? args.t;
if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
  console.error("Usage: node dist/main.js --topic \"<your topic>\"");
  process.exit(1);
}
const cleanTopic = topic.trim();

const runId = readRunId();

// ---------------------------------------------------------------------------
// Seed corpus
// ---------------------------------------------------------------------------

interface Article {
  fileName: string;
  content: string;
}

const articles: Article[] = [
  {
    fileName: `b2b_article_ai_agents_${runId}.md`,
    content:
      "AI agents are REDACTEDnomous software systems built on top of large language models (LLMs). They plan multi-step workflows, call external tools, and reflect on their own outputs. Modern agentic systems combine planning, tool use, memory, and orchestration to REDACTEDmate knowledge work. Keywords: REDACTEDnomous, agentic, planning, tool use, orchestration.",
  },
  {
    fileName: `b2b_article_rag_${runId}.md`,
    content:
      "Retrieval-Augmented Generation (RAG) augments LLM prompts with snippets retrieved from a vector store. Documents are chunked, embedded, and indexed; at query time a semantic search returns the most relevant chunks and the LLM grounds its answer in that retrieved context.",
  },
  {
    fileName: `b2b_article_vector_db_${runId}.md`,
    content:
      "Vector databases such as Pinecone, Weaviate, and pgvector store high-dimensional embeddings and support approximate nearest neighbor search. They power semantic retrieval over unstructured text, images, and code by mapping content into a shared embedding space.",
  },
  {
    fileName: `b2b_article_prompt_engineering_${runId}.md`,
    content:
      "Prompt engineering is the practice of designing effective instructions for large language models. Common techniques include few-shot examples, chain-of-thought reasoning, role prompts, and structured output formats such as JSON. Good prompts reduce hallucinations and improve task performance.",
  },
  {
    fileName: `b2b_article_devops_${runId}.md`,
    content:
      "DevOps practices accelerate software delivery through continuous integration, continuous deployment, infrastructure-as-code, and observability. Tools such as Kubernetes, Terraform, and GitHub Actions REDACTEDmate provisioning, deployment, and monitoring of production systems.",
  },
];

// ---------------------------------------------------------------------------
// Alchemyst context engine
// ---------------------------------------------------------------------------

const alchemyst = new AlchemystAI({ apiKey: ALCHEMYST_API_KEY });

async function seedArticles(): Promise<void> {
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
    console.log(
      `  [seed] ${article.fileName} -> context_id=${response.context_id} (success=${response.success})`,
    );
  }
}

async function retrieveContext(query: string): Promise<string[]> {
  const response = await alchemyst.v1.context.search({
    minimum_similarity_threshold: 0.25,
    query,
    similarity_threshold: 0.9,
    metadata: "true",
    scope: "internal",
  });

  const contexts = response.contexts ?? [];
  const snippets: string[] = [];
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

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

async function composeNewsletter(topic: string, snippets: string[]): Promise<string> {
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

function writeNewsletter(markdown: string): void {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, markdown + "\n", "utf8");
  console.log(`[done] Newsletter written to ${OUTPUT_FILE}`);
  console.log(`[done] Wrote ${markdown.length} characters`);
}

// ---------------------------------------------------------------------------
// Main flow
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
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
