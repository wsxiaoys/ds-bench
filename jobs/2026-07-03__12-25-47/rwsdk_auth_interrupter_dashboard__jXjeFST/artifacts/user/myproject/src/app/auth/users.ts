// Simple in-memory user store for the demo.
export type User = {
  username: string;
  password: string;
};

const USERS: User[] = [
  { username: 'demo', password: 'pass' },
];

export function findUser(username: string, password: string): User | null {
  const user = USERS.find(
    (u) => u.username === username && u.password === password,
  );
  return user ?? null;
}

export function getUserByUsername(username: string): User | null {
  return USERS.find((u) => u.username === username) ?? null;
}
