import { createFileRoute } from "@tanstack/react-router";
import { createPoll } from "../lib/db";

export const Route = createFileRoute("/api/polls")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json(
            { error: "Request body must be valid JSON." },
            { status: 400 },
          );
        }

        const question =
          typeof (body as any)?.question === "string"
            ? (body as any).question.trim()
            : "";

        const rawOptions = Array.isArray((body as any)?.options)
          ? (body as any).options
          : [];

        const options = rawOptions
          .filter((o: unknown): o is string => typeof o === "string")
          .map((o: string) => o.trim())
          .filter((o: string) => o.length > 0);

        if (!question || options.length < 2) {
          return Response.json(
            {
              error:
                "A question and at least two non-empty options are required.",
            },
            { status: 400 },
          );
        }

        const poll = createPoll(question, options);
        return Response.json(poll, { status: 201 });
      },
    },
  },
});
