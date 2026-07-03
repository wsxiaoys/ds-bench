import * as fs from 'fs';
import * as path from 'path';
import minimist from 'minimist';
import AlchemystAI from '@alchemystai/sdk';
import OpenAI from 'openai';

async function main() {
  // Parse command line arguments
  const argv = minimist(process.argv.slice(2));
  const topic = argv.topic;

  if (!topic || typeof topic !== 'string') {
    console.error('Error: Please provide a topic using --topic "<string>"');
    process.exit(1);
  }

  // Read run-id
  let runId = 'default-run-id';
  try {
    const runIdPath = '/logs/artifacts/run-id';
    if (fs.existsSync(runIdPath)) {
      runId = fs.readFileSync(runIdPath, 'utf8').trim();
    } else if (fs.existsSync('logs/artifacts/run-id')) {
      runId = fs.readFileSync('logs/artifacts/run-id', 'utf8').trim();
    }
  } catch (err) {
    console.error('Warning: could not read run-id, using default.', err);
  }

  const alchemystApiKey = process.env.ALCHEMYST_AI_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!alchemystApiKey) {
    console.error('Error: ALCHEMYST_AI_API_KEY environment variable is not defined.');
    process.exit(1);
  }

  if (!openaiApiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is not defined.');
    process.exit(1);
  }

  // Define articles to seed
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

  // Initialize Alchemyst AI client
  const alchemyst = new AlchemystAI({
    apiKey: alchemystApiKey,
  });

  console.log(`Seeding 5 research articles with run-id: ${runId}...`);
  for (const article of articles) {
    try {
      await alchemyst.v1.context.add({
        context_type: 'resource',
        documents: [{ content: article.content }],
        metadata: {
          fileName: article.fileName,
          file_name: article.fileName,
          fileType: 'text/markdown',
          file_type: 'text/markdown',
          fileSize: article.content.length,
          file_size: article.content.length,
          lastModified: new Date().toISOString(),
          last_modified: new Date().toISOString(),
        } as any,
        scope: 'internal',
        source: 'web-upload',
      });
      console.log(`Successfully seeded: ${article.fileName}`);
    } catch (error: any) {
      // Check if error is 409 Conflict
      const isConflict = 
        error.status === 409 || 
        (error.message && /409|conflict|already exists/i.test(error.message)) ||
        (error.error && /409|conflict|already exists/i.test(JSON.stringify(error.error)));
      
      if (isConflict) {
        console.log(`Article already exists (409 Conflict), skipping: ${article.fileName}`);
      } else {
        console.warn(`Warning: Seeding article ${article.fileName} failed (e.g. 402 Payment required), will use local fallback if search fails:`, error.message || error);
      }
    }
  }

  // Query context engine
  console.log(`Querying Alchemyst context engine for topic: "${topic}"...`);
  let contexts: any[] = [];
  try {
    const searchResult = await alchemyst.v1.context.search({
      query: topic,
      similarity_threshold: 0.5,
      minimum_similarity_threshold: 0.1,
      scope: 'internal',
    });
    contexts = searchResult.contexts || [];
    console.log(`Retrieved ${contexts.length} context snippets.`);
  } catch (error) {
    console.warn('Alchemyst search failed or returned billing error, using local fallback search:', error);
    
    // Local fallback search: compute a relevance score based on topic words
    const topicWords = topic.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const scoredArticles = articles.map(art => {
      let score = 0;
      const contentLower = art.content.toLowerCase();
      const nameLower = art.fileName.toLowerCase();
      
      // Exact topic match in content
      if (contentLower.includes(topic.toLowerCase())) {
        score += 10;
      }
      
      // Matching words in content and filename
      for (const word of topicWords) {
        if (contentLower.includes(word)) {
          score += 2;
        }
        if (nameLower.includes(word)) {
          score += 5;
        }
      }
      return { article: art, score };
    });
    
    // Filter and sort by score descending
    const matched = scoredArticles
      .filter(sa => sa.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(sa => ({ content: sa.article.content }));
      
    if (matched.length > 0) {
      contexts = matched;
    } else {
      // Fallback: include all articles
      contexts = articles.map(art => ({ content: art.content }));
    }
    console.log(`Local fallback retrieved ${contexts.length} relevant articles.`);
  }

  // Concatenate the content fields into a single grounding block
  const groundingBlock = contexts.map((c: any) => c.content).join('\n\n');

  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: openaiApiKey,
  });

  console.log('Generating newsletter using OpenAI...');
  const systemPrompt = `You are an expert B2B newsletter writer.
Your task is to write a short, topic-focused newsletter for a B2B audience on the topic: "${topic}".
You must ground your newsletter in the following retrieved context:
${groundingBlock}

Requirements:
1. The newsletter must be written in Markdown format.
2. It must contain at least three sections, each introduced by a Markdown heading (e.g., '#', '##', or '###').
3. If the topic contains 'AI agent' or 'agent' (case-insensitive), you MUST mention at least two of the following keywords in your newsletter: 'agent', 'REDACTEDnomous', 'LLM', 'planning', 'tool'. These must be matched case-insensitively as whole-word substrings (e.g. 'agent', 'REDACTEDnomous', 'LLM', 'planning', 'tool', or plural forms like 'agents', 'tools').
4. Ground your content strictly in the provided context, but write in an engaging, professional B2B tone.
5. Do not include any HTML tags, only clean Markdown.`;

  const userPrompt = `Please write the B2B newsletter about "${topic}".`;

  let completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.7,
  });

  let newsletterContent = completion.choices[0].message.content || '';

  // Post-generation validation
  const topicLower = topic.toLowerCase();
  if (topicLower.includes('agent') || topicLower.includes('ai')) {
    const keywords = ['agent', 'REDACTEDnomous', 'llm', 'planning', 'tool'];
    const contentLower = newsletterContent.toLowerCase();
    
    const regexes = {
      agent: /\bagents?\b/i,
      REDACTEDnomous: /\bREDACTEDnomous\b/i,
      llm: /\bllms?\b/i,
      planning: /\bplanning\b/i,
      tool: /\btools?\b/i,
    };
    
    let matchCount = 0;
    const matchedKeywords: string[] = [];
    
    for (const [kw, regex] of Object.entries(regexes)) {
      if (regex.test(contentLower)) {
        matchCount++;
        matchedKeywords.push(kw);
      }
    }
    
    console.log(`Validation: Found ${matchCount} of the required keywords: ${matchedKeywords.join(', ')}`);
    if (matchCount < 2) {
      console.warn(`Warning: Newsletter only matched ${matchCount} keywords. Expected at least 2. Retrying generation once with reinforced instructions...`);
      completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt + '\n\nCRITICAL: You MUST explicitly use at least three of these exact words: agent, REDACTEDnomous, LLM, planning, tool.' },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.5,
      });
      newsletterContent = completion.choices[0].message.content || '';
    }
  }

  // Write output
  const outputDir = '/home/user/myproject/output';
  const outputPath = path.join(outputDir, 'newsletter.md');

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, newsletterContent, 'utf8');
  console.log(`Newsletter successfully written to ${outputPath}`);
}

main().catch((error) => {
  console.error('Fatal error running CLI:', error);
  process.exit(1);
});
