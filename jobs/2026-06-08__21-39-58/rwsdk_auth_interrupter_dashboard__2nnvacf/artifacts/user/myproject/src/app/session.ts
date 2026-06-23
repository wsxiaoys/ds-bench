/**
 * Session utilities: HMAC-signed session cookies using Web Crypto API.
 *
 * Cookie format: payload.signature (both hex-encoded)
 * Payload: username:timestamp
 */

const COOKIE_NAME = "session";

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  return crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createSessionCookie(
  username: string,
  secret: string,
): Promise<string> {
  const timestamp = Date.now().toString();
  const payload = `${username}:${timestamp}`;
  const encoder = new TextEncoder();
  const key = await getKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const token = `${payload}.${bytesToHex(new Uint8Array(signature))}`;

  return `${COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Lax`;
}

export async function verifySessionCookie(
  request: Request,
  secret: string,
): Promise<string | null> {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;

  const cookies = parseCookies(cookieHeader);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;

  const dotIndex = token.lastIndexOf(".");
  if (dotIndex === -1) return null;

  const payload = token.substring(0, dotIndex);
  const signatureHex = token.substring(dotIndex + 1);

  if (!payload || !signatureHex) return null;

  const encoder = new TextEncoder();
  const key = await getKey(secret);

  let signature: Uint8Array;
  try {
    signature = hexToBytes(signatureHex);
  } catch {
    return null;
  }

  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    signature,
    encoder.encode(payload),
  );

  if (!valid) return null;

  const colonIndex = payload.indexOf(":");
  if (colonIndex === -1) return null;

  return payload.substring(0, colonIndex);
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0`;
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name) {
      cookies[name] = rest.join("=");
    }
  }
  return cookies;
}
