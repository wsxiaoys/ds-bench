/**
 * In-memory user store.
 *
 * The store is intentionally trivial — this is an evaluation app, not
 * production. The `demo`/`pass` credential pair is what the verifier signs
 * in with.
 */

export type UserRecord = {
  username: string;
  password: string;
};

export const USERS: readonly UserRecord[] = [
  { username: "demo", password: "pass" },
  { username: "admin", password: "admin" },
];

export function findUser(
  username: string,
  password: string,
): UserRecord | undefined {
  return USERS.find(
    (u) => u.username === username && u.password === password,
  );
}

export function findUserByUsername(
  username: string,
): UserRecord | undefined {
  return USERS.find((u) => u.username === username);
}