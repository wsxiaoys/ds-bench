import { env } from "cloudflare:workers";

/**
 * Sign a value using HMAC-SHA256 with the SESSION_SECRET.
 * Returns a hex-encoded signature.
 */
async function sign(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(env.SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verify an HMAC-SHA256 signature.
 * Uses crypto.subtle.verify for timing-safe comparison.
 */
async function verify(value: string, signature: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(env.SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  // Convert hex signature back to Uint8Array
  const sigBytes = new Uint8Array(
    signature.match(/.{2}/g)!.map((byte) => parseInt(byte, 16))
  );
  return crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(value));
}

/**
 * Create a signed session cookie value.
 * Format: username.hmac_hex_signature
 */
export async function createSessionValue(username: string): Promise<string> {
  const signature = await sign(username);
  return `${username}.${signature}`;
}

/**
 * Verify and extract username from a signed session cookie value.
 * Returns null if the cookie is invalid or tampered with.
 */
export async function verifySessionValue(cookieValue: string): Promise<string | null> {
  const dotIndex = cookieValue.lastIndexOf(".");
  if (dotIndex === -1) {
    return null;
  }

  const username = cookieValue.substring(0, dotIndex);
  const signature = cookieValue.substring(dotIndex + 1);

  if (!username || !signature) {
    return null;
  }

  const isValid = await verify(username, signature);
  return isValid ? username : null;
}

/**
 * Parse cookies from a Cookie header string.
 * Returns a Map of cookie name -> cookie value.
 */
export function parseCookies(cookieHeader: string): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const name = trimmed.substring(0, eqIndex);
    const value = trimmed.substring(eqIndex + 1);
    cookies.set(name, value);
  }
  return cookies;
}

/**
 * Get the session username from a request, verifying the HMAC signature.
 * Returns null if no valid session cookie is found.
 */
export async function getSessionUsername(request: Request): Promise<string | null> {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;

  const cookies = parseCookies(cookieHeader);
  const sessionValue = cookies.get("session");
  if (!sessionValue) return null;

  return verifySessionValue(sessionValue);
}