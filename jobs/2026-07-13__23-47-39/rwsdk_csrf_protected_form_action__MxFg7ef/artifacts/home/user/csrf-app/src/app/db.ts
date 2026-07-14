import { env } from "cloudflare:workers";

// Ensure the messages table exists. Safe to call on every request because of
// `IF NOT EXISTS`. We create the table lazily rather than relying on a separate
// migration step so the dev server works out of the box.
export async function ensureSchema(): Promise<void> {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )`,
  ).run();
}

// Persist a single message string.
export async function addMessage(message: string): Promise<void> {
  await env.DB.prepare("INSERT INTO messages (body) VALUES (?)")
    .bind(message)
    .run();
}

// Return all persisted message strings in submission order (oldest first).
export async function getMessages(): Promise<string[]> {
  const { results } = await env.DB.prepare(
    "SELECT body FROM messages ORDER BY id ASC",
  ).all<{ body: string }>();
  return results.map((row) => row.body);
}