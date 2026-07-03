/**
 * B2B Newsletter Writer CLI
 *
 * Ingests a fixed corpus of seeded research articles into the Alchemyst AI
 * context engine, retrieves the most relevant snippets for a user-supplied
 * topic, and uses the OpenAI Chat Completions API to compose a short,
 * topic-focused B2B newsletter in Markdown.
 *
 * Usage:
 *   node dist/main.js --topic "AI agents"
 */

import * as fs from 'fs';
import * as path from 'path';
import minimist from 'minimist';
import AlchemystAI from '@alchemystai/sdk';
import OpenAI from 'openai';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RUN_ID_FILE = '/logs/artifacts/run-id';
const OUTPUT_DIR = '/home/user/myproject/output';
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'newsletter.md');

const OPENAI_MODEL = 'gpt-4o-mini';

/** Topic used to retrieve context from the Alchemyst context engine. */
type SeedArticle = {
  fileName: string;
  content: string;
};

/**
 * Build the five seeded research articles, namespacing the file name with the
 * current run-id so concurrent runs do not collide and reruns do not produce
 * 409 Conflict errors.
 */
function buildSeedArticles(runId: string): SeedArticle[] {
  return [
    {
      fileName: `b2b_article_ai_agents_${runId}.md`,
      content:
        'AI agents are REDACTEDnomous software systems built on top of large language models (LLMs). ' +
        'They plan multi-step workflows, call external tools, and reflect on their own outputs. ' +
        'Modern agentic systems combine planning, tool use, memory, and orchestration to REDACTEDmate knowledge work. ' +
        'Keywords: REDACTEDnomous, agentic, planning, tool use, orchestration.',
    },
    {
      fileName: `b2b_article_rag_${runId}.md`,
      content:
        'Retrieval-Augmented Generation (RAG) augments LLM prompts with snippets retrieved from a vector store. ' +
        'Documents are chunked, embedded, and indexed; at query time a semantic search returns the most relevant ' +
        'chunks and the LLM grounds its answer in that retrieved context.',
    },
    {
      fileName: `b2b_article_vector_db_${runId}.md`,
      content:
        'Vector databases such as Pinecone, Weaviate, and pgvector store high-dimensional embeddings and support ' +
        'approximate nearest neighbor search. They power semantic retrieval over unstructured text, images, and code ' +
        'by mapping content into a shared embedding space.',
    },
    {
      fileName: `b2b_article_prompt_engineering_${runId}.md`,
      content:
        'Prompt engineering is the practice of designing effective instructions for large language models. ' +
        'Common techniques include few-shot examples, chain-of-thought reasoning, role prompts, and structured ' +
        'output formats such as JSON. Good prompts reduce hallucinations and improve task performance.',
    },
    {
      fileName: `b2b_article_devops_${runId}.md`,
      content:
        'DevOps practices accelerate software delivery through continuous integration, continuous deployment, ' +
        'infrastructure-as-code, and observability. Tools such as Kubernetes, Terraform, and GitHub Actions REDACTEDmate ' +
        'provisioning, deployment, and monitoring of production systems.',
    },
  ];
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): { topic: string } {
  const parsed = minimist(argv);
  const topic = parsed.topic ?? parsed.t;

  if (typeof topic !== 'string' || topic.trim().length === 0) {
    throw new Error(
      'Missing required --topic argument. Usage: node dist/main.js --topic "<string>"',
    );
  }

  return { topic: topic.trim() };
}

// ---------------------------------------------------------------------------
// Alchemyst helpers
// ---------------------------------------------------------------------------

function getAlchemystClient(): AlchemystAI {
  const apiKey = process.env.ALCHEMYST_AI_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error(
      'ALCHEMYST_AI_API_KEY environment variable is required but not set.',
    );
  }
  return new AlchemystAI({ apiKey });
}

async function seedArticles(
  client: AlchemystAI,
  runId: string,
): Promise<void> {
  const articles = buildSeedArticles(runId);
  const lastModified = new Date().toISOString();

  // Seed each article individually so that every document has its own
  // run-id-namespaced fileName. Doing them one at a time keeps the metadata
  // accurate per document and avoids accidental cross-document overrides.
  for (const article of articles) {
    const response = await client.v1.context.add({
      context_type: 'resource',
      scope: 'internal',
      source: 'b2b-newsletter-writer',
      documents: [{ content: article.content }],
      metadata: {
        fileName: article.fileName,
        fileType: 'text/markdown',
        lastModified,
        fileSize: Buffer.byteLength(article.content, 'utf8'),
        groupName: ['b2b-newsletter-writer', `run-${runId}`],
      },
    });
    console.log(
      `  + seeded ${article.fileName} (context_id=${response.context_id})`,
    );
  }
}

async function searchContext(
  client: AlchemystAI,
  topic: string,
): Promise<Array<{ content?: string }>> {
  const response = await client.v1.context.search({
    query: topic,
    similarity_threshold: 0.4,
    minimum_similarity_threshold: 0.1,
    scope: 'internal',
    mode: 'standard',
  });
  return response.contexts ?? [];
}

// ---------------------------------------------------------------------------
// OpenAI helpers
// ---------------------------------------------------------------------------

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error(
      'OPENAI_API_KEY environment variable is required but not set.',
    );
  }
  return new OpenAI({ apiKey });
}

async function generateNewsletter(
  client: OpenAI,
  topic: string,
  contexts: Array<{ content?: string }>,
): Promise<string> {
  const groundingBlock = contexts
    .map((c) => c.content ?? '')
    .filter((c) => c.trim().length > 0)
    .join('\n\n---\n\n');

  const systemPrompt =
    'You are a B2B newsletter editor. You produce concise, executive-ready ' +
    'newsletters for a business audience. You ground every newsletter in the ' +
    'supplied research context and never invent facts that contradict it.';

  const userPrompt =
    `Topic: ${topic}\n\n` +
    `Grounding context (research snippets):\n${groundingBlock || '(no context retrieved)'}\n\n` +
    `Write a short B2B newsletter on the topic. Requirements:\n` +
    `- Output MUST be valid Markdown.\n` +
    `- Include at least three sections, each introduced by a Markdown heading (a line starting with '#', '##', or '###').\n` +
    `- Use these section headings, in this order: "## Why it matters", "## What's new", "## What to do next".\n` +
    `- Draw on the supplied grounding context; do not invent facts outside it.\n` +
    `- Keep it tight: roughly 250-400 words total.\n` +
    `- Address a B2B / executive audience.`;

  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.4,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  const message = completion.choices?.[0]?.message?.content ?? '';
  if (message.trim().length === 0) {
    throw new Error('OpenAI returned an empty completion.');
  }
  return message;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function readRunId(): Promise<string> {
  const raw = fs.readFileSync(RUN_ID_FILE, 'utf8').trim();
  if (raw.length === 0) {
    throw new Error(`Run id file ${RUN_ID_FILE} is empty.`);
  }
  return raw;
}

function ensureOutputDir(): void {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function main(): Promise<void> {
  const { topic } = parseArgs(process.argv.slice(2));
  console.log(`Topic: ${topic}`);

  const runId = await readRunId();
  console.log(`Run-id: ${runId}`);

  const alchemyst = getAlchemystClient();
  console.log('Seeding research articles into Alchemyst context engine...');
  await seedArticles(alchemyst, runId);

  console.log('Searching Alchemyst context engine for relevant snippets...');
  const contexts = await searchContext(alchemyst, topic);
  console.log(`Retrieved ${contexts.length} context snippet(s).`);

  const openai = getOpenAIClient();
  console.log(`Generating newsletter with OpenAI (${OPENAI_MODEL})...`);
  const markdown = await generateNewsletter(openai, topic, contexts);

  ensureOutputDir();
  fs.writeFileSync(OUTPUT_FILE, markdown, 'utf8');
  console.log(`Wrote newsletter to ${OUTPUT_FILE} (${markdown.length} chars).`);
}

main().catch((err) => {
  console.error('Newsletter generation failed:');
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exitCode = 1;
});