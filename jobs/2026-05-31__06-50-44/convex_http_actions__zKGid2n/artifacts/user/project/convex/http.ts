import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const { payload, runId } = body ?? {};

    if (typeof payload !== "string" || typeof runId !== "string") {
      return new Response("Invalid payload", { status: 400 });
    }

    await ctx.runMutation(internal.webhooks.insertWebhook, {
      payload,
      runId,
    });

    return new Response("OK", { status: 200 });
  }),
});

export default http;
