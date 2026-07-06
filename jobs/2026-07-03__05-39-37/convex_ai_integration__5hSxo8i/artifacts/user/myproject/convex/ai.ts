import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

/**
 * `api.ai.list`
 *
 * Returns every document stored in the `generations` table, ordered from
 * newest to oldest by creation time.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("generations").order("desc").collect();
  },
});

/**
 * `api.ai.save`
 *
 * Inserts a new record into the `generations` table. Mutations are pure and
 * have no side effects, so this is the only place we touch the database.
 */
export const save = mutation({
  args: {
    prompt: v.string(),
    result: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("generations", {
      prompt: args.prompt,
      result: args.result,
    });
  },
});

/**
 * `api.ai.generate`
 *
 * An Action that:
 *   1. Calls the OpenAI Chat Completions API using the `OPENAI_API_KEY`
 *      environment variable (Actions are the only Convex functions allowed to
 *      perform side effects such as calling external APIs).
 *   2. Extracts the generated text from the response.
 *   3. Calls the `api.ai.save` mutation via `ctx.runMutation` to persist the
 *      prompt and the generated result in the `generations` table.
 */
export const generate = action({
  args: {
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY environment variable is not set. " +
          "Configure it with `npx convex env add OPENAI_API_KEY`."
      );
    }

    const response = await fetch(
      "REDACTED/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: args.prompt,
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenAI API request failed with status ${response.status}: ${errorText}`
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const result =
      data.choices?.[0]?.message?.content ?? "";

    // Persist the prompt and the generated result by calling the mutation.
    await ctx.runMutation(api.ai.save, {
      prompt: args.prompt,
      result,
    });

    return result;
  },
});