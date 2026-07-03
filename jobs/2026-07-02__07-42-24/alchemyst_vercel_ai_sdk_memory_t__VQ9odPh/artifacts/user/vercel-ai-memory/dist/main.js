"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/main.ts
var fs = __toESM(require("fs"));
var import_ai2 = require("ai");
var import_openai = require("@ai-sdk/openai");

// node_modules/@alchemystai/aisdk/src/tool.ts
var import_sdk = __toESM(require("@alchemystai/sdk"), 1);
var import_ai = require("ai");

// node_modules/@alchemystai/aisdk/src/schemas.ts
var import_zod = __toESM(require("zod"), 1);
var toolParamSchemas = {
  add_to_context: import_zod.default.object({
    documents: import_zod.default.array(
      import_zod.default.object({
        content: import_zod.default.string().min(1).describe("Document content (required)")
      }).and(import_zod.default.record(import_zod.default.string(), import_zod.default.any()))
    ).min(1).max(100).describe("Documents to add to context (min 1, max 100)"),
    source: import_zod.default.string().min(1).describe("Source identifier for the documents (required)"),
    context_type: import_zod.default.enum(["resource", "conversation", "instruction"]).describe("Type of context"),
    scope: import_zod.default.enum(["internal", "external"]).default("internal").describe("Scope: internal or external"),
    metadata: import_zod.default.object({
      fileName: import_zod.default.string().optional(),
      fileType: import_zod.default.string().optional(),
      lastModified: import_zod.default.string().optional(),
      fileSize: import_zod.default.number().optional(),
      groupName: import_zod.default.array(import_zod.default.string()).optional()
    }).optional().describe("Optional metadata")
  }),
  add_to_memory: import_zod.default.object({
    sessionId: import_zod.default.string().min(1).describe("The memory session ID"),
    contents: import_zod.default.array(
      import_zod.default.object({
        content: import_zod.default.string().min(1).describe("The content to store"),
        metadata: import_zod.default.object({
          source: import_zod.default.string().min(1).describe("Source of the content"),
          messageId: import_zod.default.string().min(1).describe("Message identifier"),
          type: import_zod.default.string().min(1).describe("Type of content")
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
  delete_memory: import_zod.default.object({
    memoryId: import_zod.default.string().min(1).optional().describe("The memory ID to delete"),
    sessionId: import_zod.default.string().min(1).optional().describe("Optional session ID alias"),
    user_id: import_zod.default.string().min(1).optional().describe("Optional user ID filter"),
    organization_id: import_zod.default.string().min(1).optional().describe("Optional organization ID filter")
  }).refine(
    (data) => Boolean(data.memoryId || data.sessionId),
    {
      message: "Either memoryId or sessionId is required.",
      path: ["memoryId"]
    }
  ),
  search_context: import_zod.default.object({
    query: import_zod.default.string().min(1, "Query is required.").describe("Search query string"),
    similarity_threshold: import_zod.default.number().min(0).max(1).default(0.7).describe("Similarity threshold (0-1)"),
    minimum_similarity_threshold: import_zod.default.number().min(0).max(1).default(0.5).describe("Min similarity threshold (0-1)"),
    scope: import_zod.default.enum(["internal", "external"]).default("internal").describe("Search scope"),
    body_metadata: import_zod.default.record(import_zod.default.string(), import_zod.default.any()).optional().describe("Metadata filters").refine(
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
  delete_context: import_zod.default.object({
    source: import_zod.default.string().min(1).describe("Source identifier to delete"),
    user_id: import_zod.default.string().min(1).optional().describe("Optional user ID filter"),
    organization_id: import_zod.default.string().min(1).optional().describe("Optional organization ID filter"),
    by_doc: import_zod.default.boolean().optional().default(true).describe("Delete by document"),
    by_id: import_zod.default.boolean().optional().default(false).describe("Delete by ID")
  })
};

// node_modules/@alchemystai/aisdk/src/middleware.ts
var import_sdk2 = require("@alchemystai/sdk");
function generateUUID() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  if (typeof require !== "undefined") {
    try {
      const { randomUUID } = require("crypto");
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
  const alchemyst = new import_sdk2.AlchemystAI({
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
async function run() {
  const args = process.argv.slice(2);
  let phase;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--phase" && i + 1 < args.length) {
      phase = args[i + 1];
    }
  }
  if (!phase || phase !== "establish" && phase !== "recall") {
    console.error('Error: --phase <establish|recall> is required and must be either "establish" or "recall".');
    process.exit(1);
  }
  let runId = process.env.RUN_ID;
  if (!runId) {
    const runIdFilePath = "/logs/artifacts/run-id";
    if (fs.existsSync(runIdFilePath)) {
      try {
        runId = fs.readFileSync(runIdFilePath, "utf8").trim();
      } catch (err) {
        console.error(`Error reading run-id file: ${err}`);
      }
    }
  }
  if (!process.env.ALCHEMYST_AI_API_KEY) {
    console.error("Error: ALCHEMYST_AI_API_KEY environment variable is missing.");
    process.exit(1);
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error("Error: OPENAI_API_KEY environment variable is missing.");
    process.exit(1);
  }
  if (!runId) {
    console.error("Error: RUN_ID is missing (neither process.env.RUN_ID is set nor /logs/artifacts/run-id file exists).");
    process.exit(1);
  }
  const userId = `vercel-memory-user-${runId}`;
  const sessionId = phase === "establish" ? `establish-${runId}` : `recall-${runId}`;
  const prompt = phase === "establish" ? "Please remember this about me: I am vegan and I am allergic to peanuts. Acknowledge that you will remember." : "Based on what you remember about my dietary restrictions, what should I avoid at a dinner party? List the exact dietary label(s) I told you.";
  const generateTextWithMemory = withAlchemyst(import_ai2.generateText, {
    apiKey: process.env.ALCHEMYST_AI_API_KEY
  });
  try {
    const response = await generateTextWithMemory({
      model: (0, import_openai.openai)("gpt-4o-mini"),
      prompt,
      userId,
      sessionId
    });
    console.log(response.text);
  } catch (error) {
    console.error("Error generating text with Alchemyst memory:", error);
    process.exit(1);
  }
}
run().catch((error) => {
  console.error("Unhandled execution error:", error);
  process.exit(1);
});
