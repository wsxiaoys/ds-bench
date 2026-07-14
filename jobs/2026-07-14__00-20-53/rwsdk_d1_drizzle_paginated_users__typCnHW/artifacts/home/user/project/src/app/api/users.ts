import { count, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { users } from "@/db/schema";

/**
 * Type for a user-shaped record returned by the API. We expose only the
 * columns defined in the data model contract (id, name, email), not any
 * internal metadata like `created_at`.
 */
type UserDTO = {
  id: number;
  name: string;
  email: string;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Parse a non-negative integer query parameter. Returns the default when the
 * value is missing or invalid.
 */
function parseNonNegativeInt(
  raw: string | null,
  defaultValue: number,
  max?: number,
): number {
  if (raw === null || raw === "") return defaultValue;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    return defaultValue;
  }
  if (typeof max === "number" && n > max) return max;
  return n;
}

function serializeUser(user: {
  id: number;
  name: string;
  email: string;
}): UserDTO {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}

/**
 * GET /api/users
 *
 * Lists users ordered by id ascending. Supports `limit` (default 10) and
 * `offset` (default 0) query parameters.
 */
export async function listUsers({ request }: { request: Request }) {
  const url = new URL(request.url);
  const limit = parseNonNegativeInt(url.searchParams.get("limit"), 10, 1000);
  const offset = parseNonNegativeInt(url.searchParams.get("offset"), 0);

  const [rows, totalRow] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .orderBy(users.id)
      .limit(limit)
      .offset(offset)
      .all(),
    db.select({ value: count() }).from(users).get(),
  ]);

  return jsonResponse({
    users: rows.map(serializeUser),
    total: totalRow?.value ?? 0,
    limit,
    offset,
  });
}

/**
 * POST /api/users
 *
 * Creates a new user. The request body must be JSON of shape
 * `{ "name": string, "email": string }`. Returns 201 with the created user
 * on success, 400 when name/email is missing or empty, and 409 when a user
 * with the same email already exists.
 */
export async function createUser({ request }: { request: Request }) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (
    !body ||
    typeof body !== "object" ||
    typeof (body as { name?: unknown }).name !== "string" ||
    typeof (body as { email?: unknown }).email !== "string"
  ) {
    return jsonResponse(
      { error: "`name` and `email` are required and must be strings" },
      400,
    );
  }

  const name = (body as { name: string }).name.trim();
  const email = (body as { email: string }).email.trim();

  if (name === "" || email === "") {
    return jsonResponse(
      { error: "`name` and `email` are required and must be non-empty" },
      400,
    );
  }

  // Pre-check: if a user with this email already exists, return 409 without
  // relying on the underlying SQLite constraint to surface as a 500. This
  // also avoids the unique-index error leaking through to the client.
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .get();

  if (existing) {
    return jsonResponse(
      { error: "A user with this email already exists" },
      409,
    );
  }

  try {
    const inserted = await db
      .insert(users)
      .values({ name, email })
      .returning({ id: users.id, name: users.name, email: users.email })
      .get();

    if (!inserted) {
      return jsonResponse({ error: "Failed to create user" }, 500);
    }

    return jsonResponse(serializeUser(inserted), 201);
  } catch (err) {
    // If a race condition allows two concurrent inserts with the same email,
    // the unique-index constraint will throw. Translate that to 409.
    const message = err instanceof Error ? err.message : String(err);
    if (message.toLowerCase().includes("unique")) {
      return jsonResponse(
        { error: "A user with this email already exists" },
        409,
      );
    }
    throw err;
  }
}