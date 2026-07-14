import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

export type AppContext = {};

function sseHandler() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Emit 5 message events (index 0–4)
      for (let i = 0; i < 5; i++) {
        const data = JSON.stringify({ index: i, message: `tick-${i}` });
        const event = `id: ${i}\ndata: ${data}\n\n`;
        controller.enqueue(encoder.encode(event));
      }

      // Emit terminal "done" event
      const doneEvent = `event: done\ndata: [DONE]\n\n`;
      controller.enqueue(encoder.encode(doneEvent));

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  route("/sse", { get: sseHandler }),
  render(Document, [route("/", Home)]),
]);
