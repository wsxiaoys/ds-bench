import { createServerFn } from '@tanstack/react-start';

const COOKIE_NAME = 'session_id';
const COOKIE_OPTIONS = {
  httpOnly: true,
  path: '/',
  sameSite: 'lax' as const,
  secure: false,
  maxAge: 24 * 60 * 60, // 24 hours
};

export const getCurrentUser = createServerFn({ method: 'GET' })
  .handler(async () => {
    const { getCookie } = await import('@tanstack/react-start/server');
    const { validateSession } = await import('./auth.server');
    
    const sessionId = getCookie(COOKIE_NAME);
    return validateSession(sessionId);
  });

export const registerUser = createServerFn({ method: 'POST' })
  .validator((data: any) => {
    if (!data || typeof data.username !== 'string' || typeof data.password !== 'string') {
      throw new Error('Invalid input');
    }
    return data as { username: string; password: string };
  })
  .handler(async ({ data }) => {
    const { username, password } = data;
    const { db } = await import('../db');
    const { hashPassword } = await import('./crypto');
    const { createSession } = await import('./auth.server');
    const { setCookie } = await import('@tanstack/react-start/server');

    const trimmedUsername = username.trim();
    if (!trimmedUsername || password.length < 1) {
      throw new Error('Username and password are required');
    }

    // Check if username already exists
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(trimmedUsername);
    if (existing) {
      throw new Error('Username already taken');
    }

    // Hash password and insert
    const passwordHash = hashPassword(password);
    const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
      .run(trimmedUsername, passwordHash);
    
    const userId = Number(result.lastInsertRowid);
    
    // Create session
    const sessionId = createSession(userId);
    
    // Set cookie
    setCookie(COOKIE_NAME, sessionId, COOKIE_OPTIONS);
    
    return { success: true };
  });

export const loginUser = createServerFn({ method: 'POST' })
  .validator((data: any) => {
    if (!data || typeof data.username !== 'string' || typeof data.password !== 'string') {
      throw new Error('Invalid input');
    }
    return data as { username: string; password: string };
  })
  .handler(async ({ data }) => {
    const { username, password } = data;
    const { db } = await import('../db');
    const { verifyPassword } = await import('./crypto');
    const { createSession } = await import('./auth.server');
    const { setCookie } = await import('@tanstack/react-start/server');

    const trimmedUsername = username.trim();
    if (!trimmedUsername || password.length < 1) {
      throw new Error('Username and password are required');
    }

    // Find user
    const user = db.prepare('SELECT id, password_hash FROM users WHERE username = ?').get(trimmedUsername) as { id: number; password_hash: string } | undefined;
    if (!user) {
      throw new Error('Invalid username or password');
    }

    // Verify password
    const valid = verifyPassword(password, user.password_hash);
    if (!valid) {
      throw new Error('Invalid username or password');
    }

    // Create session
    const sessionId = createSession(user.id);

    // Set cookie
    setCookie(COOKIE_NAME, sessionId, COOKIE_OPTIONS);

    return { success: true };
  });

export const logoutUser = createServerFn({ method: 'POST' })
  .handler(async () => {
    const { getCookie, deleteCookie } = await import('@tanstack/react-start/server');
    const { deleteSession } = await import('./auth.server');

    const sessionId = getCookie(COOKIE_NAME);
    if (sessionId) {
      deleteSession(sessionId);
    }

    deleteCookie(COOKIE_NAME, { path: '/' });

    return { success: true };
  });
