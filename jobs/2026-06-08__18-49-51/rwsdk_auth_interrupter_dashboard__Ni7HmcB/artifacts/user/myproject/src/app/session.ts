import { env } from "cloudflare:workers";

const COOKIE_NAME = "session";

// Encode a Uint8Array to a base64url string
function toBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// Decode a base64url string to a Uint8Array
function fromBase64Url(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getSigningKey(): Promise<CryptoKey> {
  const secret = env.SESSION_SECRET ?? "fallback-secret";
  const keyData = new TextEncoder().encode(secret);
  return crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

// Sign the payload and return "payload.signature" (both base64url)
async function signValue(payload: string): Promise<string> {
  const key = await getSigningKey();
  const data = new TextEncoder().encode(payload);
  const signature = await crypto.subtle.sign("HMAC", key, data);
  return `${payload}.${toBase64Url(signature)}`;
}

// Verify and extract the payload. Returns null if invalid.
async function verifyValue(signed: string): Promise<string | null> {
  const lastDot = signed.lastIndexOf(".");
  if (lastDot === -1) return null;

  const payload = signed.slice(0, lastDot);
  const sigStr = signed.slice(lastDot + 1);

  const key = await getSigningKey();
  const data = new TextEncoder().encode(payload);

  let sigBytes: Uint8Array;
  try {
    sigBytes = fromBase64Url(sigStr);
  } catch {
    return null;
  }

  const valid = await crypto.subtle.verify("HMAC", key, sigBytes, data);
  return valid ? payload : null;
}

/** Creates a signed session cookie value containing the username */
export async function createSessionCookie(username: string): Promise<string> {
  const payload = btoa(JSON.stringify({ username }));
  const signed = await signValue(payload);
  return `${COOKIE_NAME}=${signed}; HttpOnly; Path=/; SameSite=Lax`;
}

/** Reads and verifies the session cookie. Returns username or null. */
export async function getSessionUsername(request: Request): Promise<string | null> {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const sessionCookie = cookies.find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!sessionCookie) return null;

  const value = sessionCookie.slice(COOKIE_NAME.length + 1);
  const payload = await verifyValue(value);
  if (!payload) return null;

  try {
    const parsed = JSON.parse(atob(payload));
    return parsed.username ?? null;
  } catch {
    return null;
  }
}

/** Returns a Set-Cookie header value that clears the session cookie */
export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
}
