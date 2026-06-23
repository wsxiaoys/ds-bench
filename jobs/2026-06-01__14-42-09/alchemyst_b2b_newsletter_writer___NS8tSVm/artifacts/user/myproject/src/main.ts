import { AlchemystAI } from "@alchemystai/sdk";
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import minimist from "minimist";

interface SeedArticle {
  fileName: string;
  content: string;
}

function getSeedArticles(runId: string): SeedArticle[] {
  return [
    {
      fileName: `b2b_article_ai_agents_${runId}.md`,
      content:
        "AI agents are autonomous software systems built on top of large language models (LLMs). They plan multi-step workflows, call external tools, and reflect on their own outputs. Modern agentic systems combine planning, tool use, memory, and orchestration to automate knowledge work. Keywords: autonomous, agentic, planning, tool use, orchestration.",
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
        "DevOps practices accelerate software delivery through continuous integration, continuous deployment, infrastructure-as-code, and observability. Tools such as Kubernetes, Terraform, and GitHub Actions automate provisioning, deployment, and monitoring of production systems.",
    },
  ];
}

async function seedArticles(
  client: AlchemystAI,
  articles: SeedArticle[],
): Promise<void> {
  for (const article of articles) {
    const params: any = {
      context_type: "resource",
      scope: "internal",
      source: "b2b-newsletter-writer",
      documents: [
        {
          content: article.content,
          file_name: article.fileName,
        },
      ],
      metadata: {
        file_name: article.fileName,
        fileName: article.fileName,
        fileType: "text/markdown",
      },
    };
    try {
      await client.v1.context.add(params);
      console.log(`Seeded: ${article.fileName}`);
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status;
      if (status === 409) {
        console.log(`Already exists (409), skipping: ${article.fileName}`);
        continue;
      }
      console.error(
        `Failed to seed ${article.fileName}:`,
        err?.message ?? err,
      );
      throw err;
    }
  }
}

async function searchContext(
  client: AlchemystAI,
  topic: string,
): Promise<string> {
  try {
    const response: any = await client.v1.context.search({
      query: topic,
      minimum_similarity_threshold: 0.1,
      similarity_threshold: 0.9,
      scope: "internal",
    });
    const contexts: any[] = response?.contexts ?? [];
    const snippets = contexts
      .map((c) => (typeof c?.content === "string" ? c.content : ""))
      .filter((s) => s.length > 0);
    return snippets.join("\n\n---\n\n");
  } catch (err: any) {
    console.error("Context search failed:", err?.message ?? err);
    return "";
  }
}

async function generateNewsletter(
  openai: OpenAI,
  topic: string,
  context: string,
): Promise<string> {
  const systemPrompt = `You are a professional B2B newsletter writer. You produce concise, informative newsletters aimed at a business audience. You ALWAYS produce valid Markdown output containing at least three sections, each introduced by a Markdown heading line that starts with '#', '##', or '###'. Use headings such as '## Why it matters', '## What\\'s new', and '## What to do next'. Ground your writing in the supplied context whenever possible.`;

  const userPrompt = `Write a short B2B newsletter on the topic: "${topic}".

Requirements:
- Output must be Markdown.
- Include AT LEAST three distinct sections, each introduced by a Markdown heading (lines starting with '#', '##', or '###').
- Recommended headings: "## Why it matters", "## What's new", "## What to do next" (or similar).
- Keep the tone professional and concise.
- Draw on the following retrieved context when relevant. Mention the key concepts and keywords from the context.

--- Retrieved Context ---
${context || "(no context available)"}
--- End Context ---

Now produce the Markdown newsletter on "${topic}".`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.4,
  });

  const content = completion.choices?.[0]?.message?.content ?? "";
  return content;
}

async function main(): Promise<void> {
  const argv = minimist(process.argv.slice(2), { string: ["topic"] });
  const topic: string | undefined = argv.topic;
  if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
    console.error('Usage: node dist/main.js --topic "<topic>"');
    process.exit(1);
  }

  const alchemystKey = process.env.ALCHEMYST_AI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const runId = process.env.ZEALT_RUN_ID ?? "default-run";

  if (!alchemystKey) {
    console.error("Missing ALCHEMYST_AI_API_KEY environment variable.");
    process.exit(1);
  }
  if (!openaiKey) {
    console.error("Missing OPENAI_API_KEY environment variable.");
    process.exit(1);
  }

  const alchemyst = new AlchemystAI({ apiKey: alchemystKey });
  const openai = new OpenAI({ apiKey: openaiKey });

  const articles = getSeedArticles(runId);

  console.log(`Seeding ${articles.length} articles with run-id "${runId}"...`);
  await seedArticles(alchemyst, articles);

  console.log(`Searching context for topic: "${topic}"...`);
  const context = await searchContext(alchemyst, topic);

  console.log(`Generating newsletter with OpenAI...`);
  const newsletter = await generateNewsletter(openai, topic, context);

  const outputDir = path.resolve(process.cwd(), "output");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const outputPath = path.join(outputDir, "newsletter.md");
  fs.writeFileSync(outputPath, newsletter, "utf-8");
  console.log(`Newsletter written to: ${outputPath}`);
}

main().catch((err: any) => {
  console.error("Fatal error:", err?.message ?? err);
  process.exit(1);
});
