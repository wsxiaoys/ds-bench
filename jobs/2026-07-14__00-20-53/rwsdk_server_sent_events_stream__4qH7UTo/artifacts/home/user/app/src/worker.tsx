import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

export type AppContext = {};

// Server-Sent Events handler: streams 5 message events followed by a
// terminal `done` event, then closes the stream on its own.
const sseHandler = () => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (let i = 0; i < 5; i++) {
        const payload = JSON.stringify({ index: i, message: `tick-${i}` });
        controller.enqueue(encoder.encode(`id: ${i}\ndata: ${payload}\n\n`));
      }
      controller.enqueue(encoder.encode(`event: done\ndata: [DONE]\n\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [
    route("/", Home),
    route("/sse", { get: sseHandler }),
  ]),
]);