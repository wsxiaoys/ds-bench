import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// POST /webhook
// Reads a JSON body containing `payload` (string) and `runId` (string),
// then inserts a new record into the `webhooks` table via an internal mutation.
http.route({
  path: "/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    let body: any;
    try {
      body = await request.json();
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const payload = body?.payload;
    const runId = body?.runId;

    if (typeof payload !== "string" || typeof runId !== "string") {
      return new Response(
        JSON.stringify({
          error: "Missing or invalid `payload` or `runId` (must be strings)",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    await ctx.runMutation(internal.webhooks.insertWebhook, {
      payload,
      runId,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;