import { env } from "cloudflare:workers";

function generateSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function getSidCookie(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const name = trimmed.substring(0, index);
    const value = trimmed.substring(index + 1);
    if (name === "sid") {
      return value;
    }
  }
  return null;
}

export async function createSessionHandler({ request }: { request: Request }) {
  try {
    const body = await request.json() as { userId?: string };
    if (!body || typeof body.userId !== "string") {
      return new Response(JSON.stringify({ error: "Invalid request body. Expected { userId: string }" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const sessionId = generateSessionId();
    const createdAt = Math.floor(Date.now() / 1000);
    const expiresAt = createdAt + 3600;

    const sessionData = {
      userId: body.userId,
      createdAt,
      expiresAt
    };

    // Store in KV under "sess:<sessionId>" with expirationTtl of 3600
    await env.SESSIONS.put(`sess:${sessionId}`, JSON.stringify(sessionData), {
      expirationTtl: 3600
    });

    return new Response(JSON.stringify({ sessionId, expiresAt }), {
      status: 201,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `sid=${sessionId}; HttpOnly; Path=/; Max-Age=3600`
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function getSessionHandler({ request }: { request: Request }) {
  const sid = getSidCookie(request);
  if (!sid || !/^[0-9a-f]{32}$/.test(sid)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  const sessionDataStr = await env.SESSIONS.get(`sess:${sid}`);
  if (!sessionDataStr) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const session = JSON.parse(sessionDataStr) as { userId: string; createdAt: number; expiresAt: number };
    return new Response(JSON.stringify({
      userId: session.userId,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function deleteSessionHandler({ request }: { request: Request }) {
  const sid = getSidCookie(request);
  if (sid && /^[0-9a-f]{32}$/.test(sid)) {
    await env.SESSIONS.delete(`sess:${sid}`);
  }

  return new Response(null, {
    status: 204,
    headers: {
      "Set-Cookie": "sid=; HttpOnly; Path=/; Max-Age=0"
    }
  });
}

export async function countSessionsHandler() {
  try {
    let count = 0;
    let cursor: string | undefined = undefined;
    while (true) {
      const result: any = await env.SESSIONS.list({
        prefix: "sess:",
        cursor
      });
      count += result.keys.length;
      if (result.list_complete) {
        break;
      }
      cursor = result.cursor;
      if (!cursor) {
        break;
      }
    }

    return new Response(JSON.stringify({ count }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
