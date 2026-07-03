import { render, route } from "rwsdk/router";
import { defineApp, type RequestInfo } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import {
  createUser,
  deleteUser,
  getUser,
  isValidUserPayload,
  listUsers,
  updateUser,
  type User,
} from "@/usersStore";

export type AppContext = {};

const jsonResponse = (
  body: unknown,
  init: { status?: number } = {},
): Response => {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers,
  });
};

const jsonError = (status: number, message: string): Response =>
  jsonResponse({ error: message }, { status });

type ApiHandler = (info: RequestInfo) => Promise<Response>;

const parseJsonBody = async (request: Request): Promise<unknown> => {
  try {
    const text = await request.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

const listUsersHandler: ApiHandler = async () =>
  jsonResponse({ users: listUsers() });

const createUserHandler: ApiHandler = async ({ request }) => {
  const body = await parseJsonBody(request);
  if (!isValidUserPayload(body)) {
    return jsonError(400, "invalid payload");
  }
  const user = createUser({ name: body.name, email: body.email });
  return jsonResponse(user, { status: 201 });
};

const getUserHandler: ApiHandler = async ({ params }) => {
  const user = getUser(params.id);
  if (!user) return jsonError(404, "not found");
  return jsonResponse(user);
};

const updateUserHandler: ApiHandler = async ({ params, request }) => {
  const existing = getUser(params.id);
  if (!existing) return jsonError(404, "not found");
  const body = await parseJsonBody(request);
  if (body === null || body === undefined) {
    return jsonError(400, "invalid payload");
  }
  if (typeof body !== "object") {
    return jsonError(400, "invalid payload");
  }
  const patch: { name?: string; email?: string } = {};
  const obj = body as Record<string, unknown>;
  if ("name" in obj) {
    if (typeof obj.name !== "string") return jsonError(400, "invalid payload");
    patch.name = obj.name;
  }
  if ("email" in obj) {
    if (typeof obj.email !== "string") return jsonError(400, "invalid payload");
    patch.email = obj.email;
  }
  const updated = updateUser(params.id, patch);
  if (!updated) return jsonError(404, "not found");
  return jsonResponse(updated);
};

const deleteUserHandler: ApiHandler = async ({ params }) => {
  const ok = deleteUser(params.id);
  if (!ok) return jsonError(404, "not found");
  return new Response(null, { status: 204 });
};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  route("/api/users", {
    get: listUsersHandler,
    post: createUserHandler,
  }),
  route("/api/users/:id", {
    get: getUserHandler,
    put: updateUserHandler,
    delete: deleteUserHandler,
  }),
  render(Document, [route("/", Home)]),
]);
