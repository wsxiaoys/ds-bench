export type User = {
  id: string;
  name: string;
  email: string;
};

// Module-level in-memory store. State persists across requests within the
// lifetime of the worker module instance.
const users = new Map<string, User>();

export function listUsers(): User[] {
  // Map preserves insertion order, so the values() iterator returns users
  // in the order they were inserted.
  return Array.from(users.values());
}

export function getUser(id: string): User | undefined {
  return users.get(id);
}

export function createUser(input: { name: string; email: string }): User {
  const user: User = {
    id: crypto.randomUUID(),
    name: input.name,
    email: input.email,
  };
  users.set(user.id, user);
  return user;
}

export function updateUser(
  id: string,
  patch: { name?: string; email?: string },
): User | undefined {
  const existing = users.get(id);
  if (!existing) return undefined;
  const updated: User = {
    id: existing.id,
    name: patch.name !== undefined ? patch.name : existing.name,
    email: patch.email !== undefined ? patch.email : existing.email,
  };
  users.set(id, updated);
  return updated;
}

export function deleteUser(id: string): boolean {
  return users.delete(id);
}

export function isValidUserPayload(value: unknown): value is {
  name: string;
  email: string;
} {
  if (value === null || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.name === "string" &&
    typeof obj.email === "string"
  );
}
