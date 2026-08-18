import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [
    route("/", Home),
    route("/sse", {
      get: () => {
        const stream = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder();
            try {
              for (let i = 0; i < 5; i++) {
                const data = JSON.stringify({ index: i, message: `tick-${i}` });
                const chunk = `id: ${i}\ndata: ${data}\n\n`;
                controller.enqueue(encoder.encode(chunk));
                await new Promise((resolve) => setTimeout(resolve, 100));
              }
              const terminal = `event: done\ndata: [DONE]\n\n`;
              controller.enqueue(encoder.encode(terminal));
            } catch (err) {
              console.error("Stream error:", err);
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          },
        });
      },
    }),
  ]),
]);
