import type { RequestHandler } from "@builder.io/qwik-city";
import { castVote } from "../../../../db";

export const onPost: RequestHandler = async (ev) => {
  const pollId = ev.params.id;

  let body: any;
  try {
    body = await ev.parseBody();
  } catch (err) {
    ev.status(400);
    ev.json(400, { error: "Invalid option ID" });
    return;
  }

  if (!body || typeof body !== "object" || typeof body.optionId !== "number" || isNaN(body.optionId)) {
    ev.status(400);
    ev.json(400, { error: "Invalid option ID" });
    return;
  }

  const optionId = body.optionId;

  // Extract IP address from X-Forwarded-For or fall back to connection socket IP
  let ip = ev.request.headers.get("x-forwarded-for");
  if (ip) {
    ip = ip.split(",")[0].trim();
  } else {
    ip = ev.clientConn.ip || "127.0.0.1";
  }

  const result = castVote(pollId, optionId, ip);

  if (!result.success) {
    const statusCode = result.status || 500;
    ev.status(statusCode);
    ev.json(statusCode, { error: result.error });
    return;
  }

  ev.status(200);
  ev.json(200, {
    success: true,
    votes: result.votes,
  });
};
