interface User {
  username: string;
  password: string;
}

/**
 * In-memory user store.
 * The demo user (demo/pass) is always available.
 */
const users: User[] = [
  { username: "demo", password: "pass" },
];

/**
 * Authenticate a user by username and password.
 * Returns the username if credentials are valid, or null otherwise.
 */
export function authenticate(
  username: string,
  password: string
): string | null {
  const user = users.find(
    (u) => u.username === username && u.password === password
  );
  return user ? user.username : null;
}