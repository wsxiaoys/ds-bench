import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { payload, runId } = body;

      if (runId === undefined || runId === null || typeof runId !== "string") {
        return new Response("Missing or invalid runId", { status: 400 });
      }

      let payloadStr: string;
      if (typeof payload === "string") {
        payloadStr = payload;
      } else if (payload !== undefined && payload !== null) {
        payloadStr = JSON.stringify(payload);
      } else {
        payloadStr = "";
      }

      await ctx.runMutation(internal.webhooks.insertWebhook, {
        payload: payloadStr,
        runId: runId,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: String(error) }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
  }),
});

export default http;
