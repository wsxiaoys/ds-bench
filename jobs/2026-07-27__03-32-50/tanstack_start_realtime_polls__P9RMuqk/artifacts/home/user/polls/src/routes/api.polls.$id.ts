import { createFileRoute } from "@tanstack/react-router";
import { getPollById } from "../lib/db";

export const Route = createFileRoute("/api/polls/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const poll = getPollById(params.id);
        if (!poll) {
          return Response.json({ error: "Poll not found." }, { status: 404 });
        }
        return Response.json(poll, { status: 200 });
      },
    },
  },
});
