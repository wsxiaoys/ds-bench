import crypto from "node:crypto";
import fs from "node:fs";

// Read secret from /home/user/session_secret.txt
let secret = "";
try {
  secret = fs.readFileSync("/home/user/session_secret.txt", "utf8").trim();
} catch (err) {
  console.error("Error reading session secret file:", err);
}

/**
 * Sign session data (username) using HMAC-SHA256
 */
export function signSession(username: string): string {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(username);
  const signature = hmac.digest("hex");
  return `${username}.${signature}`;
}

/**
 * Verify signed session cookie value.
 * Returns the username if valid, otherwise null.
 */
export function verifySession(cookieValue: string | undefined): string | null {
  if (!cookieValue) return null;
  const parts = cookieValue.split(".");
  if (parts.length !== 2) return null;

  const [username, signature] = parts;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(username);
  const expectedSignature = hmac.digest("hex");

  if (signature === expectedSignature) {
    return username;
  }
  return null;
}

/**
 * Parse cookies from Cookie header string
 */
export function parseCookies(cookieHeader: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const key = pair.substring(0, idx).trim();
    const value = pair.substring(idx + 1).trim();
    cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}
