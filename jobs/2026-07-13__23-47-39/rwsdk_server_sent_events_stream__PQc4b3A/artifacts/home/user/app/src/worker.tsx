import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

export type AppContext = {};

/**
 * A streaming Server-Sent Events (SSE) endpoint.
 *
 * `GET /sse` returns a `text/event-stream` response that pushes exactly 5
 * message events (indexed 0-4) followed by a single terminal `event: done`
 * event, after which the server closes the stream.
 */
function sseStream(): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < 5; i++) {
        const data = JSON.stringify({ index: i, message: `tick-${i}` });
        const event =
          `id: ${i}\n` + `data: ${data}\n` + `\n`;
        controller.enqueue(encoder.encode(event));
      }

      // Terminal event signaling the end of the stream.
      const doneEvent = `event: done\n` + `data: [DONE]\n` + `\n`;
      controller.enqueue(encoder.encode(doneEvent));

      controller.close();
    },
  });
}

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  route("/sse", {
    get: () => {
      return new Response(sseStream(), {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    },
  }),
  render(Document, [route("/", Home)]),
]);
