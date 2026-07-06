export type User = {
  id: string;
  name: string;
  email: string;
};

const users = new Map<string, User>();

const jsonResponse = (body: unknown, init: ResponseInit = {}): Response => {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { ...init, headers });
};

export const listUsers = (): Response => {
  return jsonResponse({ users: Array.from(users.values()) });
};

export const createUser = async (request: Request): Promise<Response> => {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "invalid payload" }, { status: 400 });
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    typeof (payload as Record<string, unknown>).name !== "string" ||
    typeof (payload as Record<string, unknown>).email !== "string"
  ) {
    return jsonResponse({ error: "invalid payload" }, { status: 400 });
  }

  const { name, email } = payload as { name: string; email: string };
  const user: User = {
    id: crypto.randomUUID(),
    name,
    email,
  };
  users.set(user.id, user);
  return jsonResponse(user, { status: 201 });
};

export const getUser = (id: string): Response => {
  const user = users.get(id);
  if (!user) {
    return jsonResponse({ error: "not found" }, { status: 404 });
  }
  return jsonResponse(user);
};

export const updateUser = async (
  id: string,
  request: Request,
): Promise<Response> => {
  const existing = users.get(id);
  if (!existing) {
    return jsonResponse({ error: "not found" }, { status: 404 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "invalid payload" }, { status: 400 });
  }

  if (!payload || typeof payload !== "object") {
    return jsonResponse({ error: "invalid payload" }, { status: 400 });
  }

  const body = payload as Record<string, unknown>;
  const updated: User = { ...existing };

  if (Object.prototype.hasOwnProperty.call(body, "name")) {
    if (typeof body.name !== "string") {
      return jsonResponse({ error: "invalid payload" }, { status: 400 });
    }
    updated.name = body.name;
  }
  if (Object.prototype.hasOwnProperty.call(body, "email")) {
    if (typeof body.email !== "string") {
      return jsonResponse({ error: "invalid payload" }, { status: 400 });
    }
    updated.email = body.email;
  }

  users.set(id, updated);
  return jsonResponse(updated);
};

export const deleteUser = (id: string): Response => {
  if (!users.has(id)) {
    return jsonResponse({ error: "not found" }, { status: 404 });
  }
  users.delete(id);
  return new Response(null, { status: 204 });
};
