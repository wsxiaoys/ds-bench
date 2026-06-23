import { AlchemystAI } from '@alchemystai/sdk';
import OpenAI from 'openai';
import minimist from 'minimist';
import fs from 'fs';
import path from 'path';

async function main() {
  const args = minimist(process.argv.slice(2));
  const topic = args.topic;

  if (!topic) {
    console.error('Error: --topic argument is required');
    process.exit(1);
  }

  const alchemystApiKey = process.env.ALCHEMYST_AI_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const runId = process.env.ZEALT_RUN_ID || 'default-run-id';

  if (!alchemystApiKey || !openaiApiKey) {
    console.error('Error: ALCHEMYST_AI_API_KEY and OPENAI_API_KEY environment variables are required');
    process.exit(1);
  }

  const alchemyst = new AlchemystAI({ apiKey: alchemystApiKey });
  const openai = new OpenAI({ apiKey: openaiApiKey });

  const articles = [
    {
      file_name: `b2b_article_ai_agents_${runId}.md`,
      content: `AI agents are autonomous software systems built on top of large language models (LLMs). They plan multi-step workflows, call external tools, and reflect on their own outputs. Modern agentic systems combine planning, tool use, memory, and orchestration to automate knowledge work. Keywords: autonomous, agentic, planning, tool use, orchestration.`
    },
    {
      file_name: `b2b_article_rag_${runId}.md`,
      content: `Retrieval-Augmented Generation (RAG) augments LLM prompts with snippets retrieved from a vector store. Documents are chunked, embedded, and indexed; at query time a semantic search returns the most relevant chunks and the LLM grounds its answer in that retrieved context.`
    },
    {
      file_name: `b2b_article_vector_db_${runId}.md`,
      content: `Vector databases such as Pinecone, Weaviate, and pgvector store high-dimensional embeddings and support approximate nearest neighbor search. They power semantic retrieval over unstructured text, images, and code by mapping content into a shared embedding space.`
    },
    {
      file_name: `b2b_article_prompt_engineering_${runId}.md`,
      content: `Prompt engineering is the practice of designing effective instructions for large language models. Common techniques include few-shot examples, chain-of-thought reasoning, role prompts, and structured output formats such as JSON. Good prompts reduce hallucinations and improve task performance.`
    },
    {
      file_name: `b2b_article_devops_${runId}.md`,
      content: `DevOps practices accelerate software delivery through continuous integration, continuous deployment, infrastructure-as-code, and observability. Tools such as Kubernetes, Terraform, and GitHub Actions automate provisioning, deployment, and monitoring of production systems.`
    }
  ];

  console.log('Seeding articles to Alchemyst...');
  for (const article of articles) {
    try {
      await alchemyst.v1.context.add({
        context_type: 'resource',
        documents: [{ content: article.content }],
        scope: 'internal',
        source: 'newsletter-writer',
        metadata: {
          fileName: article.file_name,
          file_name: article.file_name,
          fileSize: Buffer.byteLength(article.content, 'utf8'),
          fileType: 'text/markdown',
          lastModified: new Date().toISOString()
        } as any
      });
    } catch (e: any) {
      if (e.status === 409) {
        console.log(`Article ${article.file_name} already exists. Skipping.`);
      } else {
        throw e;
      }
    }
  }

  console.log(`Searching for topic: ${topic}`);
  const searchResults = await alchemyst.v1.context.search({
    query: topic,
    minimum_similarity_threshold: 0.0,
    similarity_threshold: 1.0,
    scope: 'internal'
  });

  const contexts = searchResults.contexts || [];
  const retrievedContext = contexts.map((r: any) => r.content).join('\n\n');

  console.log('Generating newsletter with OpenAI...');
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a B2B newsletter writer. Write a short newsletter on the provided topic, grounded in the following context.
The output MUST be in Markdown format and contain at least three sections, each introduced by a Markdown heading (starting with #, ##, or ###).
Example headings: "## Why it matters", "## What's new", "## What to do next".
Make sure to use the provided context to inform your writing.

Context:
${retrievedContext}`
      },
      {
        role: 'user',
        content: `Please write a B2B newsletter about: ${topic}`
      }
    ]
  });

  const newsletterContent = response.choices[0].message.content || '';

  const outputDir = path.join(process.cwd(), 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'newsletter.md');
  fs.writeFileSync(outputPath, newsletterContent, 'utf-8');

  console.log(`Newsletter written to ${outputPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
