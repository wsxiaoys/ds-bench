import * as fs from 'fs';
import * as path from 'path';
import AlchemystAI from '@alchemystai/sdk';
import OpenAI from 'openai';

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const RUN_ID_PATH = '/logs/artifacts/run-id';
const OUTPUT_PATH = '/home/user/myproject/output/newsletter.md';
const OPENAI_MODEL = 'gpt-4o-mini';
const CONTEXT_SOURCE = 'b2b-newsletter-writer';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function readRunId(): string {
  const raw = fs.readFileSync(RUN_ID_PATH, 'utf8').trim();
  if (!raw) {
    throw new Error(`Run-id file at ${RUN_ID_PATH} is empty.`);
  }
  return raw;
}

function parseTopic(argv: string[]): string {
  // Minimal CLI parser: supports `--topic "AI agents"` and `--topic=AI agents`.
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--topic') {
      const value = argv[i + 1];
      if (!value) {
        throw new Error('A value must be supplied for --topic.');
      }
      return value;
    }
    if (arg.startsWith('--topic=')) {
      return arg.slice('--topic='.length);
    }
  }
  throw new Error('Missing required --topic <string> argument.');
}

interface SeedArticle {
  fileName: string;
  content: string;
}

function buildSeedArticles(runId: string): SeedArticle[] {
  return [
    {
      fileName: `b2b_article_ai_agents_${runId}.md`,
      content:
        'AI agents are REDACTEDnomous software systems built on top of large language models (LLMs). They plan multi-step workflows, call external tools, and reflect on their own outputs. Modern agentic systems combine planning, tool use, memory, and orchestration to REDACTEDmate knowledge work. Keywords: REDACTEDnomous, agentic, planning, tool use, orchestration.',
    },
    {
      fileName: `b2b_article_rag_${runId}.md`,
      content:
        'Retrieval-Augmented Generation (RAG) augments LLM prompts with snippets retrieved from a vector store. Documents are chunked, embedded, and indexed; at query time a semantic search returns the most relevant chunks and the LLM grounds its answer in that retrieved context.',
    },
    {
      fileName: `b2b_article_vector_db_${runId}.md`,
      content:
        'Vector databases such as Pinecone, Weaviate, and pgvector store high-dimensional embeddings and support approximate nearest neighbor search. They power semantic retrieval over unstructured text, images, and code by mapping content into a shared embedding space.',
    },
    {
      fileName: `b2b_article_prompt_engineering_${runId}.md`,
      content:
        'Prompt engineering is the practice of designing effective instructions for large language models. Common techniques include few-shot examples, chain-of-thought reasoning, role prompts, and structured output formats such as JSON. Good prompts reduce hallucinations and improve task performance.',
    },
    {
      fileName: `b2b_article_devops_${runId}.md`,
      content:
        'DevOps practices accelerate software delivery through continuous integration, continuous deployment, infrastructure-as-code, and observability. Tools such as Kubernetes, Terraform, and GitHub Actions REDACTEDmate provisioning, deployment, and monitoring of production systems.',
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Alchemyst seeding + search                                         */
/* ------------------------------------------------------------------ */

async function seedArticles(
  client: AlchemystAI,
  articles: SeedArticle[],
): Promise<void> {
  for (const article of articles) {
    // The metadata is namespaced with the run-id via the file_name so that
    // repeated runs never collide with a 409 Conflict. We set both the
    // SDK-supported `fileName` field and the `file_name` alias so the
    // namespacing is recorded regardless of which key the backend indexes on.
    const metadata = {
      fileName: article.fileName,
      file_name: article.fileName,
      fileType: 'text/markdown',
      fileSize: Buffer.byteLength(article.content, 'utf8'),
      lastModified: new Date().toISOString(),
    } as Record<string, unknown>;

    await client.v1.context.add({
      documents: [{ content: article.content }],
      context_type: 'resource',
      source: CONTEXT_SOURCE,
      scope: 'internal',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: metadata as any,
    });
  }
  console.log(`Seeded ${articles.length} articles into the Alchemyst context engine.`);
}

async function searchContext(
  client: AlchemystAI,
  topic: string,
): Promise<string[]> {
  const { contexts } = await client.v1.context.search({
    query: topic,
    similarity_threshold: 1.0,
    minimum_similarity_threshold: 0.2,
    scope: 'internal',
  });

  const snippets: string[] = [];
  if (contexts && contexts.length > 0) {
    for (const ctx of contexts) {
      if (ctx.content) {
        snippets.push(ctx.content);
      }
    }
  }
  console.log(`Retrieved ${snippets.length} context snippet(s) for topic "${topic}".`);
  return snippets;
}

/* ------------------------------------------------------------------ */
/* OpenAI newsletter generation                                       */
/* ------------------------------------------------------------------ */

async function generateNewsletter(
  openai: OpenAI,
  topic: string,
  contextSnippets: string[],
): Promise<string> {
  const groundingBlock =
    contextSnippets.length > 0
      ? contextSnippets
          .map((snippet, idx) => `--- Context ${idx + 1} ---\n${snippet}`)
          .join('\n\n')
      : '(No additional context was retrieved.)';

  const systemPrompt = [
    'You are an expert B2B newsletter writer.',
    'You write concise, insightful newsletters for a business-to-business audience.',
    'You always respond in well-structured Markdown.',
  ].join(' ');

  const userPrompt = [
    `Write a short B2B newsletter about the following topic: "${topic}".`,
    '',
    'You MUST ground your newsletter in the retrieved context provided below.',
    'Reuse the specific terminology, keywords, and concepts that appear in the',
    'context (for example terms such as "REDACTEDnomous", "agent", "planning",',
    '"tool use", "LLM", "RAG", "vector database", or "prompt engineering" where',
    'they are relevant to the topic).',
    '',
    'Your response MUST be valid Markdown and contain at least three sections,',
    'each introduced by a Markdown heading (a line starting with #, ##, or ###).',
    'Use the following section headings (you may add more if helpful):',
    '  ## Why it matters',
    '  ## What\'s new',
    '  ## What to do next',
    '',
    'Do not wrap the response in code fences. Output only the Markdown newsletter.',
    '',
    '=== RETRIEVED CONTEXT ===',
    groundingBlock,
    '=== END RETRIEVED CONTEXT ===',
  ].join('\n');

  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.4,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI returned an empty completion.');
  }
  return content.trim();
}

/* ------------------------------------------------------------------ */
/* Output                                                             */
/* ------------------------------------------------------------------ */

function writeNewsletter(markdown: string): void {
  const dir = path.dirname(OUTPUT_PATH);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, markdown, 'utf8');
  console.log(`Newsletter written to ${OUTPUT_PATH}`);
}

/* ------------------------------------------------------------------ */
/* Main                                                               */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  const alchemystKey = process.env.ALCHEMYST_AI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!alchemystKey) {
    throw new Error('ALCHEMYST_AI_API_KEY environment variable is not set.');
  }
  if (!openaiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set.');
  }

  const topic = parseTopic(process.argv.slice(2));
  const runId = readRunId();
  console.log(`Run ID: ${runId}`);
  console.log(`Topic: ${topic}`);

  const alchemyst = new AlchemystAI({ apiKey: alchemystKey });
  const openai = new OpenAI({ apiKey: openaiKey });

  // 1. Seed the five research articles (run-id namespaced => idempotent).
  const articles = buildSeedArticles(runId);
  await seedArticles(alchemyst, articles);

  // 2. Query the context engine for the most relevant snippets.
  const snippets = await searchContext(alchemyst, topic);

  // 3. Compose the newsletter with OpenAI, grounded in the retrieved context.
  const newsletter = await generateNewsletter(openai, topic, snippets);

  // 4. Persist the newsletter as Markdown.
  writeNewsletter(newsletter);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});