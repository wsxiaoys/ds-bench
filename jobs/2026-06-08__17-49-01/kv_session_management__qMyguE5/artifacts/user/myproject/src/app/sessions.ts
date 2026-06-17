import { env } from "cloudflare:workers";
import { RequestInfo } from "rwsdk/worker";

// Helper to generate a random 32-character lowercase hex string
function generateSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Helper to parse the sid cookie from the Cookie header
function parseSidCookie(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.trim().split("=");
    if (name === "sid") {
      return valueParts.join("=");
    }
  }
  return null;
}

export const handlePostSessions = async ({ request }: RequestInfo): Promise<Response> => {
  let body: any;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userId = body?.userId;
  if (typeof userId !== "string") {
    return new Response(JSON.stringify({ error: "Missing or invalid userId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const sessionId = generateSessionId();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 3600;

  const sessionRecord = {
    userId,
    createdAt: now,
    expiresAt,
  };

  const sessionsKv = (env as any).SESSIONS;
  await sessionsKv.put(`sess:${sessionId}`, JSON.stringify(sessionRecord), {
    expirationTtl: 3600,
  });

  return new Response(
    JSON.stringify({
      sessionId,
      expiresAt,
    }),
    {
      status: 201,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `sid=${sessionId}; Path=/; HttpOnly; Max-Age=3600`,
      },
    }
  );
};

export const handleGetMe = async ({ request }: RequestInfo): Promise<Response> => {
  const sid = parseSidCookie(request);
  if (!sid || !/^[0-9a-f]{32}$/.test(sid)) {
    return new Response(null, { status: 401 });
  }

  const sessionsKv = (env as any).SESSIONS;
  const sessionDataStr = await sessionsKv.get(`sess:${sid}`);
  if (!sessionDataStr) {
    return new Response(null, { status: 401 });
  }

  let sessionData: any;
  try {
    sessionData = JSON.parse(sessionDataStr);
  } catch (e) {
    return new Response(null, { status: 401 });
  }

  if (!sessionData || typeof sessionData.userId !== "string") {
    return new Response(null, { status: 401 });
  }

  // Extra safety check in case KV eviction hasn't run yet
  const now = Math.floor(Date.now() / 1000);
  if (sessionData.expiresAt && sessionData.expiresAt < now) {
    return new Response(null, { status: 401 });
  }

  return new Response(
    JSON.stringify({
      userId: sessionData.userId,
      createdAt: sessionData.createdAt,
      expiresAt: sessionData.expiresAt,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
};

export const handleDeleteMe = async ({ request }: RequestInfo): Promise<Response> => {
  const sid = parseSidCookie(request);
  if (!sid || !/^[0-9a-f]{32}$/.test(sid)) {
    return new Response(null, { status: 401 });
  }

  const sessionsKv = (env as any).SESSIONS;
  await sessionsKv.delete(`sess:${sid}`);

  return new Response(null, {
    status: 204,
    headers: {
      "Set-Cookie": "sid=; Path=/; HttpOnly; Max-Age=0",
    },
  });
};

export const handleGetCount = async (): Promise<Response> => {
  const sessionsKv = (env as any).SESSIONS;
  let count = 0;
  let cursor: string | undefined = undefined;
  let listComplete = false;

  while (!listComplete) {
    const listResult: any = await sessionsKv.list({
      prefix: "sess:",
      cursor,
    });

    count += listResult.keys.length;
    cursor = listResult.cursor;
    listComplete = listResult.list_complete;

    if (!cursor && !listComplete) {
      break;
    }
  }

  return new Response(
    JSON.stringify({
      count,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
};
