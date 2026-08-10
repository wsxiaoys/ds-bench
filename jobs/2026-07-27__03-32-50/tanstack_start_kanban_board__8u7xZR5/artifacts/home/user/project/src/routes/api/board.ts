import { createFileRoute } from "@tanstack/react-router";
import { getBoard } from "~/server/db";

export const Route = createFileRoute("/api/board")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json(getBoard());
      },
    },
  },
});
