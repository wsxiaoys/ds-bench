/**
 * Simple in-memory user store with hardcoded demo credentials.
 */

interface User {
  username: string;
  password: string;
}

const users: User[] = [
  { username: "demo", password: "pass" },
];

export function findUser(username: string, password: string): User | undefined {
  return users.find(
    (u) => u.username === username && u.password === password,
  );
}
