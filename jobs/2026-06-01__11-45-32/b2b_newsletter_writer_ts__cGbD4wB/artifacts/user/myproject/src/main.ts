import fs from "fs/promises";
import path from "path";
import minimist from "minimist";
import OpenAI from "openai";
import { Alchemyst } from "@alchemystai/sdk";

const AI_AGENT_KEYWORDS = ["agent", "autonomous", "LLM", "planning", "tool"];

type ContextItem = {
  content?: string;
  text?: string;
};

const seededArticles = (runId: string) => [
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

const parseArgs = () => {
  const args = minimist(process.argv.slice(2), {
    string: ["topic"],
  });

  const topic = args.topic?.trim();
  if (!topic) {
    throw new Error("Missing required --topic argument.");
  }

  return { topic };
};

const requireEnv = (name: string) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const seedContext = async (client: Alchemyst, runId: string) => {
  const articles = seededArticles(runId);
  for (const article of articles) {
    await client.v1.context.add({
      content: article.content,
      context_type: "resource",
      scope: "internal",
      metadata: {
        file_name: article.fileName,
      },
    });
  }
};

const extractContextText = (response: unknown) => {
  if (!response || typeof response !== "object") {
    return [] as ContextItem[];
  }

  const anyResponse = response as { data?: ContextItem[]; contexts?: ContextItem[]; results?: ContextItem[] };
  const items = anyResponse.data ?? anyResponse.contexts ?? anyResponse.results ?? [];
  if (!Array.isArray(items)) {
    return [] as ContextItem[];
  }
  return items;
};

const formatPrompt = (topic: string, contextBlock: string) => {
  const keywordInstruction = topic.toLowerCase().includes("ai agents")
    ? `Include at least two of these keywords (case-insensitive, whole-word): ${AI_AGENT_KEYWORDS.join(
        ", "
      )}.`
    : "";

  return {
    system: "You are a B2B marketing writer. Produce concise, factual newsletters grounded in provided context.",
    user: `Write a short B2B newsletter about: ${topic}.

Use the following context snippets as grounding:
${contextBlock}

Requirements:
- Output Markdown.
- Provide at least three sections, each with a Markdown heading (start lines with ##).
- Keep it concise and focused on business impact.
${keywordInstruction}
`,
  };
};

const writeNewsletter = async (content: string) => {
  const outputDir = path.resolve("output");
  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, "newsletter.md");
  await fs.writeFile(outputPath, content, "utf8");
};

const main = async () => {
  const { topic } = parseArgs();
  const alchemystApiKey = requireEnv("ALCHEMYST_AI_API_KEY");
  const openAiApiKey = requireEnv("OPENAI_API_KEY");
  const runId = requireEnv("ZEALT_RUN_ID");

  const alchemyst = new Alchemyst({ apiKey: alchemystApiKey });
  const openai = new OpenAI({ apiKey: openAiApiKey });

  await seedContext(alchemyst, runId);

  const searchResponse = await alchemyst.v1.context.search({
    query: topic,
    scope: "internal",
    top_k: 5,
  });

  const contexts = extractContextText(searchResponse)
    .map((item) => item.content ?? item.text ?? "")
    .filter((value) => value.trim().length > 0);

  const contextBlock = contexts.length > 0 ? contexts.join("\n\n") : "(No context returned.)";
  const prompt = formatPrompt(topic, contextBlock);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
    temperature: 0.4,
  });

  const messageContent = completion.choices[0]?.message?.content?.trim();
  if (!messageContent) {
    throw new Error("OpenAI response did not include content.");
  }

  await writeNewsletter(`${messageContent}\n`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
