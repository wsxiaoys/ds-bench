#!/usr/bin/env node
//# sourceURL=vercel-ai-memory/dist/main.js
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/main.ts
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

// node_modules/@alchemystai/aisdk/src/tool.ts
import AlchemystAI from "@alchemystai/sdk";
import { tool } from "ai";

// node_modules/@alchemystai/aisdk/src/schemas.ts
import z from "zod";
var toolParamSchemas = {
  add_to_context: z.object({
    documents: z.array(
      z.object({
        content: z.string().min(1).describe("Document content (required)")
      }).and(z.record(z.string(), z.any()))
    ).min(1).max(100).describe("Documents to add to context (min 1, max 100)"),
    source: z.string().min(1).describe("Source identifier for the documents (required)"),
    context_type: z.enum(["resource", "conversation", "instruction"]).describe("Type of context"),
    scope: z.enum(["internal", "external"]).default("internal").describe("Scope: internal or external"),
    metadata: z.object({
      fileName: z.string().optional(),
      fileType: z.string().optional(),
      lastModified: z.string().optional(),
      fileSize: z.number().optional(),
      groupName: z.array(z.string()).optional()
    }).optional().describe("Optional metadata")
  }),
  add_to_memory: z.object({
    sessionId: z.string().min(1).describe("The memory session ID"),
    contents: z.array(
      z.object({
        content: z.string().min(1).describe("The content to store"),
        metadata: z.object({
          source: z.string().min(1).describe("Source of the content"),
          messageId: z.string().min(1).describe("Message identifier"),
          type: z.string().min(1).describe("Type of content")
        }).passthrough().refine(
          (data) => JSON.stringify(data).length < 1e5,
          { message: "Metadata too large (max 100KB)" }
        )
      }).passthrough().refine(
        (data) => JSON.stringify(data).length < 1e6,
        // 1MB per item limit
        { message: "Content item too large (max 1MB)" }
      )
    ).min(1).max(100).describe("Array of content items (min 1, max 100)")
  }),
  delete_memory: z.object({
    memoryId: z.string().min(1).optional().describe("The memory ID to delete"),
    sessionId: z.string().min(1).optional().describe("Optional session ID alias"),
    user_id: z.string().min(1).optional().describe("Optional user ID filter"),
    organization_id: z.string().min(1).optional().describe("Optional organization ID filter")
  }).refine(
    (data) => Boolean(data.memoryId || data.sessionId),
    {
      message: "Either memoryId or sessionId is required.",
      path: ["memoryId"]
    }
  ),
  search_context: z.object({
    query: z.string().min(1, "Query is required.").describe("Search query string"),
    similarity_threshold: z.number().min(0).max(1).default(0.7).describe("Similarity threshold (0-1)"),
    minimum_similarity_threshold: z.number().min(0).max(1).default(0.5).describe("Min similarity threshold (0-1)"),
    scope: z.enum(["internal", "external"]).default("internal").describe("Search scope"),
    body_metadata: z.record(z.string(), z.any()).optional().describe("Metadata filters").refine(
      (data) => !data || JSON.stringify(data).length < 1e4,
      { message: "Metadata too large (max 10KB)" }
    )
  }).refine(
    (data) => data.minimum_similarity_threshold <= data.similarity_threshold,
    {
      message: "minimum_similarity_threshold must be <= similarity_threshold.",
      path: ["minimum_similarity_threshold"]
    }
  ),
  delete_context: z.object({
    source: z.string().min(1).describe("Source identifier to delete"),
    user_id: z.string().min(1).optional().describe("Optional user ID filter"),
    organization_id: z.string().min(1).optional().describe("Optional organization ID filter"),
    by_doc: z.boolean().optional().default(true).describe("Delete by document"),
    by_id: z.boolean().optional().default(false).describe("Delete by ID")
  })
};

// node_modules/@alchemystai/aisdk/src/middleware.ts
import { AlchemystAI as AlchemystAI2 } from "@alchemystai/sdk";
function generateUUID() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  if (typeof __require !== "undefined") {
    try {
      const { randomUUID } = __require("crypto");
      return randomUUID();
    } catch {
    }
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}
function withAlchemyst(aiFunction, options = {}) {
  const {
    apiKey = process.env.ALCHEMYST_API_KEY,
    baseUrl,
    source = `memory_conversation_${Date.now()}`,
    withMemory = true,
    similarityThreshold = 0.7,
    minimumSimilarityThreshold = 0.5,
    maxMemories = 10,
    scope = "internal",
    contextType = "conversation",
    metadata: globalMetadata = {},
    debug = false
  } = options;
  if (typeof apiKey !== "string" || apiKey.trim() === "") {
    throw new Error(
      "ALCHEMYST_API_KEY is required. Please provide it via options.apiKey or set the ALCHEMYST_API_KEY environment variable."
    );
  }
  const alchemyst = new AlchemystAI2({
    apiKey,
    ...baseUrl ? { baseUrl } : {}
  });
  const wrappedFn = async (params) => {
    const { userId, sessionId, metadata: callMetadata, ...aiFunctionParams } = params;
    const resolvedSessionId = sessionId || userId || "default";
    let enhancedParams = { ...aiFunctionParams };
    if (withMemory && (userId || sessionId)) {
      try {
        const userMessage = Array.isArray(aiFunctionParams.messages) ? aiFunctionParams.messages.find((m) => m.role === "user")?.content : aiFunctionParams.prompt;
        const query = typeof userMessage === "string" ? userMessage : JSON.stringify(userMessage);
        if (!query || query.trim() === "") {
          throw new Error("Cannot retrieve memory context without a query.");
        }
        const memoryResults = await alchemyst.v1.context.search({
          query,
          similarity_threshold: similarityThreshold,
          minimum_similarity_threshold: minimumSimilarityThreshold,
          scope
        });
        if (debug) {
          console.log("[Alchemyst] Memory retrieval results:", {
            query,
            found: memoryResults.contexts?.length ?? 0
          });
        }
        if (memoryResults.contexts && memoryResults.contexts.length > 0) {
          const contextString = memoryResults.contexts.slice(0, maxMemories).map((r, i) => {
            const sanitized = r.content?.replace(/</g, "&lt;").replace(/>/g, "&gt;");
            return sanitized ? `[Memory ${i + 1}]: ${sanitized}` : null;
          }).filter(Boolean).join("\n");
          const systemContext = `Previous conversation context (for reference only):
${contextString}

`;
          if (Array.isArray(aiFunctionParams.messages)) {
            const messages = [...aiFunctionParams.messages];
            const systemIndex = messages.findIndex((m) => m.role === "system");
            if (systemIndex >= 0) {
              const existingContent = messages[systemIndex].content;
              const existingContentStr = typeof existingContent === "string" ? existingContent : "";
              messages[systemIndex] = {
                role: "system",
                content: systemContext + existingContentStr
              };
            } else {
              messages.unshift({ role: "system", content: systemContext });
            }
            enhancedParams = { ...aiFunctionParams, messages };
          } else if ("system" in aiFunctionParams && aiFunctionParams.system) {
            enhancedParams = {
              ...aiFunctionParams,
              system: systemContext + aiFunctionParams.system
            };
          } else {
            enhancedParams = {
              ...aiFunctionParams,
              system: systemContext
            };
          }
        }
      } catch {
      }
    }
    const userMessageSentAt = (/* @__PURE__ */ new Date()).toISOString();
    const result = await aiFunction(enhancedParams);
    const aiMessageSentAt = (/* @__PURE__ */ new Date()).toISOString();
    if (userId || sessionId) {
      const userMessage = Array.isArray(aiFunctionParams.messages) ? aiFunctionParams.messages.find((m) => m.role === "user")?.content : aiFunctionParams.prompt;
      const storeMemory = async (responseText) => {
        const userContentRaw = typeof userMessage === "string" ? userMessage : JSON.stringify(userMessage);
        const userContent = userContentRaw ?? "";
        const groupName = [
          ...Array.isArray(globalMetadata.groupName) ? globalMetadata.groupName : ["default"],
          sessionId
        ].filter((value) => typeof value === "string" && value.trim() !== "");
        const sharedMetadata = {
          userId,
          sessionId: resolvedSessionId,
          contextType,
          scope,
          appSource: source,
          groupName,
          ...globalMetadata,
          ...callMetadata
        };
        const memoryPayload = {
          sessionId: resolvedSessionId,
          contents: [
            {
              content: `[user:] ${userContent}`,
              metadata: {
                role: "user",
                messageId: generateUUID(),
                source: "user",
                type: "message",
                timestamp: userMessageSentAt,
                ...sharedMetadata
              }
            },
            {
              content: `[assistant:] ${responseText}`,
              metadata: {
                messageId: generateUUID(),
                role: "assistant",
                source: "assistant",
                type: "message",
                model: String(aiFunctionParams.model),
                timestamp: aiMessageSentAt,
                ...sharedMetadata
              }
            }
          ]
        };
        await alchemyst.v1.context.memory.add(memoryPayload);
      };
      if ("text" in result) {
        const textValue = result.text;
        const responseText = typeof textValue === "string" ? textValue : await textValue;
        if (responseText) {
          await storeMemory(responseText);
        }
      } else if ("textStream" in result) {
        const streamResult = result;
        const originalStream = streamResult.textStream;
        let fullText = "";
        const wrappedStream = new ReadableStream({
          async start(controller) {
            try {
              for await (const chunk of originalStream) {
                fullText += chunk;
                controller.enqueue(chunk);
              }
              if (fullText) {
                await storeMemory(fullText);
              }
              controller.close();
            } catch (err) {
              controller.error(err);
            }
          }
        });
        const asyncIterableStream = Object.assign(wrappedStream, {
          [Symbol.asyncIterator]() {
            const reader = wrappedStream.getReader();
            return {
              async next() {
                const { done, value } = await reader.read();
                return { done, value };
              },
              async return() {
                reader.releaseLock();
                return { done: true, value: void 0 };
              }
            };
          }
        });
        return { ...streamResult, textStream: asyncIterableStream };
      }
    }
    return result;
  };
  return wrappedFn;
}

// src/main.ts
var PHASE_PROMPTS = {
  establish: "Please remember this about me: I am vegan and I am allergic to peanuts. Acknowledge that you will remember.",
  recall: "Based on what you remember about my dietary restrictions, what should I avoid at a dinner party? List the exact dietary label(s) I told you."
};
function parseArgs(argv) {
  const idx = argv.indexOf("--phase");
  if (idx === -1 || idx + 1 >= argv.length) return null;
  const val = argv[idx + 1];
  if (val === "establish" || val === "recall") return val;
  return null;
}
function fail(msg) {
  process.stderr.write(`Error: ${msg}
`);
  process.exit(1);
}
async function main() {
  const phase = parseArgs(process.argv.slice(2));
  if (!phase) {
    fail("missing or invalid --phase argument (expected 'establish' or 'recall')");
  }
  const alchemystKey = process.env.ALCHEMYST_AI_API_KEY;
  if (!alchemystKey) fail("ALCHEMYST_AI_API_KEY environment variable is required");
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) fail("OPENAI_API_KEY environment variable is required");
  const runId = process.env.RUN_ID;
  if (!runId) fail("RUN_ID environment variable is required");
  const userId = `vercel-memory-user-${runId}`;
  const sessionId = phase === "establish" ? `establish-${runId}` : `recall-${runId}`;
  const generateTextWithMemory = withAlchemyst(generateText, {
    apiKey: alchemystKey,
    source: "vercel-ai-memory-cli"
  });
  const prompt = PHASE_PROMPTS[phase];
  const result = await generateTextWithMemory({
    model: openai("gpt-4o-mini"),
    prompt,
    userId,
    sessionId
  });
  const text = typeof result.text === "string" ? result.text : await result.text;
  process.stdout.write(text + "\n");
}
main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Error: ${msg}
`);
  process.exit(1);
});
