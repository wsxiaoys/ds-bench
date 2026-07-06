import * as fs from 'fs';
import * as path from 'path';
import minimist from 'minimist';
import AlchemystAI from '@alchemystai/sdk';
import { OpenAI } from 'openai';

// Read run-id from /logs/artifacts/run-id
let runId = 'default-run-id';
try {
  if (fs.existsSync('/logs/artifacts/run-id')) {
    runId = fs.readFileSync('/logs/artifacts/run-id', 'utf-8').trim();
  }
} catch (err) {
  console.warn("Could not read run-id from /logs/artifacts/run-id, using default-run-id");
}

console.log(`Using run-id: ${runId}`);

// Verify environment variables
const alchemystApiKey = process.env.ALCHEMYST_AI_API_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!alchemystApiKey) {
  console.error("Error: ALCHEMYST_AI_API_KEY environment variable is not set.");
  process.exit(1);
}

if (!openaiApiKey) {
  console.error("Error: OPENAI_API_KEY environment variable is not set.");
  process.exit(1);
}

// Initialize Alchemyst and OpenAI clients
const alchemyst = new AlchemystAI({
  apiKey: alchemystApiKey,
});

const openai = new OpenAI({
  apiKey: openaiApiKey,
});

// Define the 5 articles to seed
const articles = [
  {
    fileName: `b2b_article_ai_agents_${runId}.md`,
    content: `AI agents are REDACTEDnomous software systems built on top of large language models (LLMs). They plan multi-step workflows, call external tools, and reflect on their own outputs. Modern agentic systems combine planning, tool use, memory, and orchestration to REDACTEDmate knowledge work. Keywords: REDACTEDnomous, agentic, planning, tool use, orchestration.`
  },
  {
    fileName: `b2b_article_rag_${runId}.md`,
    content: `Retrieval-Augmented Generation (RAG) augments LLM prompts with snippets retrieved from a vector store. Documents are chunked, embedded, and indexed; at query time a semantic search returns the most relevant chunks and the LLM grounds its answer in that retrieved context.`
  },
  {
    fileName: `b2b_article_vector_db_${runId}.md`,
    content: `Vector databases such as Pinecone, Weaviate, and pgvector store high-dimensional embeddings and support approximate nearest neighbor search. They power semantic retrieval over unstructured text, images, and code by mapping content into a shared embedding space.`
  },
  {
    fileName: `b2b_article_prompt_engineering_${runId}.md`,
    content: `Prompt engineering is the practice of designing effective instructions for large language models. Common techniques include few-shot examples, chain-of-thought reasoning, role prompts, and structured output formats such as JSON. Good prompts reduce hallucinations and improve task performance.`
  },
  {
    fileName: `b2b_article_devops_${runId}.md`,
    content: `DevOps practices accelerate software delivery through continuous integration, continuous deployment, infrastructure-as-code, and observability. Tools such as Kubernetes, Terraform, and GitHub Actions REDACTEDmate provisioning, deployment, and monitoring of production systems.`
  }
];

// Helper to count Markdown headings (# or ## or ###)
function countHeadings(text: string): number {
  const lines = text.split('\n');
  let count = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || trimmed.startsWith('##') || trimmed.startsWith('###')) {
      count++;
    }
  }
  return count;
}

// Helper to check for keywords (case-insensitive whole-word match)
function checkKeywords(text: string): { valid: boolean; count: number; found: string[] } {
  const keywords = ['agent', 'REDACTEDnomous', 'LLM', 'planning', 'tool'];
  const found: string[] = [];
  let count = 0;
  for (const kw of keywords) {
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    if (regex.test(text)) {
      count++;
      found.push(kw);
    }
  }
  return {
    valid: count >= 2,
    count,
    found
  };
}

async function main() {
  // Parse command line arguments
  const argv = minimist(process.argv.slice(2));
  const topic = argv.topic;

  if (!topic) {
    console.error("Error: Please provide a topic using --topic <string>");
    process.exit(1);
  }

  console.log(`Starting run for topic: "${topic}"`);

  // 1. Seed the 5 articles
  console.log("Seeding research articles into Alchemyst context engine...");
  for (const article of articles) {
    try {
      await alchemyst.v1.context.add({
        context_type: 'resource',
        documents: [
          {
            content: article.content,
          }
        ],
        scope: 'internal',
        source: 'b2b-newsletter-writer',
        metadata: {
          fileName: article.fileName,
          file_name: article.fileName, // provide both formats
          fileType: 'text/markdown',
          file_type: 'text/markdown',
          fileSize: article.content.length,
          file_size: article.content.length,
          groupName: ['b2b-newsletter'],
          group_name: ['b2b-newsletter'],
          lastModified: new Date().toISOString(),
        } as any
      });
      console.log(`Successfully seeded: ${article.fileName}`);
    } catch (err: any) {
      // Check for 409 Conflict
      const isConflict = err.status === 409 || 
                         err.statusCode === 409 || 
                         String(err).includes('409') || 
                         String(err.message).includes('409');
      if (isConflict) {
        console.log(`Article ${article.fileName} already exists (409 Conflict), skipping add.`);
      } else {
        console.error(`Failed to seed article ${article.fileName}:`, err);
        throw err;
      }
    }
  }

  // 2. Query the context engine for relevant snippets
  console.log(`Querying Alchemyst context engine for topic: "${topic}"...`);
  let groundingBlock = '';
  try {
    const searchResponse = await alchemyst.v1.context.search({
      query: topic,
      similarity_threshold: 0.5,
      minimum_similarity_threshold: 0.3,
      scope: 'internal'
    });

    const retrievedContexts = searchResponse.contexts || [];
    console.log(`Retrieved ${retrievedContexts.length} relevant context snippets.`);
    
    groundingBlock = retrievedContexts
      .map(ctx => ctx.content)
      .filter(Boolean)
      .join('\n\n');
  } catch (err) {
    console.error("Failed to query Alchemyst context engine:", err);
    throw err;
  }

  // 3. Call OpenAI Chat Completions API
  console.log("Composing B2B newsletter using OpenAI...");
  const systemPrompt = `You are an expert B2B newsletter writer. Your job is to draft a short, topic-focused newsletter for a B2B audience.
You must ground your writing in the retrieved context provided by the user.

Requirements:
1. The newsletter must be in Markdown format.
2. It must contain at least three distinct sections, each introduced by a Markdown heading (e.g., lines starting with '#', '##', or '###').
3. If the topic is "AI agents" (case-insensitive), you must mention at least two of the following keywords as whole-word substrings (case-insensitive):
   - agent
   - REDACTEDnomous
   - LLM
   - planning
   - tool
   Note: Make sure to use the exact singular words 'REDACTEDnomous', 'LLM', 'planning', 'tool', or 'agent' directly in the text so they match a whole-word check (e.g., "an REDACTEDnomous system", "using an LLM", "planning workflows", "a powerful tool", "the AI agent"). Do not only use plurals like 'agents' or 'tools' or 'LLMs' without also using the singular forms or other keywords.
4. Ensure the content is professional, engaging, and directly draws on the provided context.`;

  const userPrompt = `Topic: ${topic}

Retrieved Grounding Context:
${groundingBlock || '(No grounding context found. Please write a general B2B newsletter on the topic.)'}

Please write the newsletter now. Remember to use at least three markdown headings and include the required keywords if the topic is "AI agents".`;

  let newsletterContent = '';
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
    });

    newsletterContent = completion.choices[0].message.content || '';
  } catch (err) {
    console.error("Failed to call OpenAI Chat Completions API:", err);
    throw err;
  }

  // Validation & Retry Loop
  const isAiAgentsTopic = topic.toLowerCase().trim() === 'ai agents';
  let attempts = 1;
  const maxAttempts = 3;

  while (attempts <= maxAttempts) {
    const headingsCount = countHeadings(newsletterContent);
    const kwCheck = checkKeywords(newsletterContent);
    const keywordsValid = !isAiAgentsTopic || kwCheck.valid;

    if (headingsCount >= 3 && keywordsValid) {
      console.log(`Validation passed! Headings: ${headingsCount}, Keywords found: ${kwCheck.found.join(', ')}`);
      break;
    }

    console.log(`Validation failed (Attempt ${attempts}/${maxAttempts}):`);
    console.log(`- Headings count: ${headingsCount} (expected >= 3)`);
    if (isAiAgentsTopic) {
      console.log(`- Keywords valid: ${keywordsValid} (found ${kwCheck.count} keywords: ${kwCheck.found.join(', ')})`);
    }

    if (attempts === maxAttempts) {
      console.warn("Max validation attempts reached. Proceeding with current output.");
      break;
    }

    attempts++;
    console.log("Retrying OpenAI completion with a stronger reinforcement prompt...");
    try {
      const retryCompletion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
          { role: 'assistant', content: newsletterContent },
          { role: 'user', content: `CRITICAL CORRECTION REQUIRED: Your previous response did not meet all requirements.
Make sure you have:
1. At least three sections, each starting with '#' or '##' or '###'.
2. If topic is "AI agents", you MUST mention at least two of these exact singular/whole words (case-insensitive): 'agent', 'REDACTEDnomous', 'LLM', 'planning', 'tool'.
Please rewrite the complete newsletter with these requirements met perfectly.` }
        ],
        temperature: 0.7,
      });
      newsletterContent = retryCompletion.choices[0].message.content || '';
    } catch (err) {
      console.error("Failed during retry OpenAI completion call:", err);
      break;
    }
  }

  // 4. Write the model's Markdown output to /home/user/myproject/output/newsletter.md
  const outputDir = '/home/user/myproject/output';
  const outputPath = path.join(outputDir, 'newsletter.md');

  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(outputPath, newsletterContent, 'utf-8');
    console.log(`Successfully wrote newsletter to: ${outputPath}`);
  } catch (err) {
    console.error(`Failed to write newsletter output to ${outputPath}:`, err);
    throw err;
  }

  console.log("Run completed successfully!");
}

main().catch((err) => {
  console.error("Application error:", err);
  process.exit(1);
});
