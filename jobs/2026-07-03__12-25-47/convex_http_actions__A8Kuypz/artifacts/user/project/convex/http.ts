import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const { payload, runId } = body;
    await ctx.runMutation(internal.webhooks.insertWebhook, {
      payload,
      runId,
    });
    return new Response(null, { status: 200 });
  }),
});

export default http;
