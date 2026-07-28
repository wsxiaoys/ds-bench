import { createFileRoute } from "@tanstack/react-router";
import crypto from "node:crypto";
import { voteOnPoll } from "../lib/db";
import { buildClientIdSetCookie, parseClientId } from "../lib/cookies";

export const Route = createFileRoute("/api/polls/$id/vote")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json(
            { error: "Request body must be valid JSON." },
            { status: 400 },
          );
        }

        const optionId =
          typeof (body as any)?.optionId === "string"
            ? (body as any).optionId
            : "";

        if (!optionId) {
          return Response.json(
            { error: "optionId is required." },
            { status: 400 },
          );
        }

        const clientId = parseClientId(request) ?? crypto.randomUUID();

        const result = voteOnPoll(params.id, optionId, clientId);

        if (!result.ok) {
          if (
            result.reason === "poll_not_found" ||
            result.reason === "option_not_found"
          ) {
            return Response.json(
              { error: "Poll or option not found." },
              { status: 404 },
            );
          }

          // already_voted
          const headers = new Headers({ "Content-Type": "application/json" });
          headers.append("Set-Cookie", buildClientIdSetCookie(clientId));
          return new Response(
            JSON.stringify({
              error: "You have already voted on this poll.",
            }),
            { status: 409, headers },
          );
        }

        const headers = new Headers({ "Content-Type": "application/json" });
        headers.append("Set-Cookie", buildClientIdSetCookie(clientId));
        return new Response(JSON.stringify(result.poll), {
          status: 200,
          headers,
        });
      },
    },
  },
});
