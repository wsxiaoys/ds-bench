import minimist from "minimist";
import AlchemystAI from "@alchemystai/sdk";
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";

// ── CLI argument parsing ───────────────────────────────────────────────
const argv = minimist(process.argv.slice(2));
const rawTopic: string | undefined = argv.topic;

if (!rawTopic || typeof rawTopic !== "string" || rawTopic.trim().length === 0) {
  console.error('Error: --topic argument is required. Usage: node dist/main.js --topic "<topic>"');
  process.exit(1);
}

const topic: string = rawTopic;

// ── Environment variables ─────────────────────────────────────────────
const ALCHEMYST_API_KEY = process.env.ALCHEMYST_AI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const RUN_ID = process.env.ZEALT_RUN_ID || "default";

if (!ALCHEMYST_API_KEY) {
  console.error("Error: ALCHEMYST_AI_API_KEY environment variable is not set.");
  process.exit(1);
}
if (!OPENAI_API_KEY) {
  console.error("Error: OPENAI_API_KEY environment variable is not set.");
  process.exit(1);
}

// ── Seeded research articles ──────────────────────────────────────────
const ARTICLES: Array<{
  fileName: string;
  content: string;
}> = [
  {
    fileName: `b2b_article_ai_agents_${RUN_ID}.md`,
    content:
      "AI agents are autonomous software systems built on top of large language models (LLMs). They plan multi-step workflows, call external tools, and reflect on their own outputs. Modern agentic systems combine planning, tool use, memory, and orchestration to automate knowledge work. Keywords: autonomous, agentic, planning, tool use, orchestration.",
  },
  {
    fileName: `b2b_article_rag_${RUN_ID}.md`,
    content:
      "Retrieval-Augmented Generation (RAG) augments LLM prompts with snippets retrieved from a vector store. Documents are chunked, embedded, and indexed; at query time a semantic search returns the most relevant chunks and the LLM grounds its answer in that retrieved context.",
  },
  {
    fileName: `b2b_article_vector_db_${RUN_ID}.md`,
    content:
      "Vector databases such as Pinecone, Weaviate, and pgvector store high-dimensional embeddings and support approximate nearest neighbor search. They power semantic retrieval over unstructured text, images, and code by mapping content into a shared embedding space.",
  },
  {
    fileName: `b2b_article_prompt_engineering_${RUN_ID}.md`,
    content:
      "Prompt engineering is the practice of designing effective instructions for large language models. Common techniques include few-shot examples, chain-of-thought reasoning, role prompts, and structured output formats such as JSON. Good prompts reduce hallucinations and improve task performance.",
  },
  {
    fileName: `b2b_article_devops_${RUN_ID}.md`,
    content:
      "DevOps practices accelerate software delivery through continuous integration, continuous deployment, infrastructure-as-code, and observability. Tools such as Kubernetes, Terraform, and GitHub Actions automate provisioning, deployment, and monitoring of production systems.",
  },
];

// ── Main async flow ───────────────────────────────────────────────────
async function main(): Promise<void> {
  // 1. Initialise clients
  const alchemyst = new AlchemystAI({ apiKey: ALCHEMYST_API_KEY });
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  // 2. Seed the five articles into the Alchemyst context engine
  console.log("Seeding research articles into Alchemyst context engine...");
  for (const article of ARTICLES) {
    try {
      await alchemyst.v1.context.add({
        documents: [{ content: article.content }],
        context_type: "resource",
        source: "web-upload",
        scope: "internal",
        metadata: {
          fileName: article.fileName,
          fileType: "text/markdown",
          lastModified: new Date().toISOString(),
          fileSize: Buffer.byteLength(article.content, "utf-8"),
        },
      });
      console.log(`  ✓ Seeded: ${article.fileName}`);
    } catch (error: any) {
      // 409 Conflict means the document already exists – safe to skip
      if (error?.status === 409 || error?.statusCode === 409) {
        console.log(`  ⊘ Already exists (skipped): ${article.fileName}`);
      } else {
        console.error(`  ✗ Error seeding ${article.fileName}:`, error?.message || error);
        throw error;
      }
    }
  }

  // 3. Search the context engine for relevant snippets
  console.log(`Searching context engine for topic: "${topic}"...`);
  const searchResult = await alchemyst.v1.context.search({
    query: topic,
    similarity_threshold: 0.8,
    minimum_similarity_threshold: 0.3,
    scope: "internal",
  });

  const contexts = searchResult.contexts ?? [];
  const contextBlock = contexts
    .map((ctx: any, idx: number) => {
      const content = typeof ctx.content === "string" ? ctx.content : JSON.stringify(ctx.content);
      return `[Context ${idx + 1}]: ${content}`;
    })
    .join("\n\n");

  console.log(`  Retrieved ${contexts.length} context snippet(s).`);

  // 4. Build the OpenAI prompt
  const systemPrompt = `You are a professional B2B newsletter writer. You produce concise, insightful newsletters for a business audience. You always write in Markdown format with clear section headings.`;

  const userPrompt = `Write a short B2B newsletter on the topic: "${topic}".

Use the following retrieved context to ground your newsletter. Draw facts, terminology, and insights from the context where relevant.

${contextBlock || "(No specific context was retrieved — write based on general knowledge.)"}

Requirements:
- Write the newsletter in Markdown.
- Include at least three sections, each introduced by a Markdown heading (## Why it matters, ## What's new, ## What to do next — or similar headings of your choice).
- Keep each section concise (2-4 sentences).
- Use professional B2B tone.
- Explicitly reference concepts from the provided context.`;

  // 5. Call OpenAI Chat Completions API
  console.log("Generating newsletter with OpenAI (gpt-4o-mini)...");
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 1024,
  });

  const newsletter = completion.choices[0]?.message?.content ?? "";

  if (!newsletter.trim()) {
    console.error("Error: OpenAI returned an empty response.");
    process.exit(1);
  }

  // 6. Write the newsletter to output/newsletter.md
  const outputDir = path.resolve(process.cwd(), "output");
  const outputPath = path.join(outputDir, "newsletter.md");

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, newsletter, "utf-8");

  console.log(`Newsletter written to ${outputPath}`);
  console.log("--- Newsletter Preview ---");
  console.log(newsletter);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});