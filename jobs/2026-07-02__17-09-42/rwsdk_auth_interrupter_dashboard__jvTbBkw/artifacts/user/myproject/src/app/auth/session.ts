import {
  createSessionCookie,
  isValidSessionId,
  signSessionId,
} from "rwsdk/auth";

/**
 * The signed cookie value carries the username as the unsigned session id.
 *
 * Format: base64("<username>:<hex-hmac-sha256>")
 *
 * Because the signature uses HMAC-SHA256 with the secret injected at
 * build time by `vite.config.mts`, any tampering of the signature portion
 * invalidates the cookie.
 *
 * The secret is loaded once at Vite startup from
 * `/home/user/session_secret.txt` and exposed to the runtime code as the
 * `__SESSION_SECRET__` constant.
 */

declare const __SESSION_SECRET__: string;

const SESSION_COOKIE_NAME = "session";

function getSessionSecret(): string {
  const secret = __SESSION_SECRET__;
  if (!secret) {
    throw new Error(
      "Session secret is empty. Did /home/user/session_secret.txt contain data?",
    );
  }
  return secret;
}

const toBase64 =
  typeof btoa === "function"
    ? (s: string) => btoa(s)
    : (s: string) => Buffer.from(s, "binary").toString("base64");

/** Pack the username and signature into the cookie value. */
function pack(username: string, signature: string): string {
  return toBase64(`${username}:${signature}`);
}

/** Build the cookie header value that establishes a session for `username`. */
export async function buildSessionSetCookie(username: string): Promise<string> {
  const secretKey = getSessionSecret();
  const signature = await signSessionId({
    unsignedSessionId: username,
    secretKey,
  });
  const sessionId = pack(username, signature);
  return createSessionCookie({
    name: SESSION_COOKIE_NAME,
    sessionId,
  });
}

/** Build the cookie header value that clears the session cookie. */
export function buildClearSessionCookie(): string {
  return createSessionCookie({
    name: SESSION_COOKIE_NAME,
    sessionId: "",
    maxAge: 0,
  });
}

/**
 * Pull the `session` cookie value out of a request, or `null` if it is
 * missing / malformed.
 */
export function readSessionCookie(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const name = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    if (name === SESSION_COOKIE_NAME && value) {
      return value;
    }
  }
  return null;
}

/** The username embedded in a valid session cookie, or `null` if invalid. */
export async function verifySessionCookie(
  request: Request,
): Promise<string | null> {
  const cookieValue = readSessionCookie(request);
  if (!cookieValue) return null;

  const secretKey = getSessionSecret();

  // rwsdk's `isValidSessionId` expects a base64-packed value matching the
  // same shape it produced when signing. We pass exactly that shape so any
  // character flipped in the signature portion of the cookie will cause
  // the HMAC comparison to fail.
  const valid = await isValidSessionId({
    sessionId: cookieValue,
    secretKey,
  });
  if (!valid) return null;

  // Unpack the cookie value to recover the username.
  let decoded: string;
  try {
    decoded =
      typeof atob === "function"
        ? atob(cookieValue)
        : Buffer.from(cookieValue, "base64").toString("binary");
  } catch {
    return null;
  }
  const colon = decoded.indexOf(":");
  if (colon === -1) return null;
  const username = decoded.slice(0, colon);
  if (!username) return null;
  return username;
}