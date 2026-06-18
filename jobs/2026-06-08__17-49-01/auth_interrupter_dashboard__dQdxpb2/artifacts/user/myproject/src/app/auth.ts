import { env } from "cloudflare:workers";

// Demo credentials pair
export const DEMO_USER = {
  username: "demo",
  password: "pass",
};

// Helper to parse cookies from Request headers
export function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  const cookies: Record<string, string> = {};
  cookieHeader.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    const name = parts[0].trim();
    if (name) {
      cookies[name] = parts.slice(1).join("=").trim();
    }
  });
  return cookies;
}

// Retrieve session secret from env securely with fallbacks
function getSessionSecret(): string {
  let secret = "";
  try {
    secret = (env as any).SESSION_SECRET;
  } catch (e) {}

  if (!secret) {
    try {
      secret = (globalThis as any).SESSION_SECRET;
    } catch (e) {}
  }

  if (!secret) {
    try {
      secret = (globalThis as any).env?.SESSION_SECRET;
    } catch (e) {}
  }

  if (!secret) {
    try {
      secret = (import.meta.env as any).SESSION_SECRET;
    } catch (e) {}
  }

  return secret || "default-session-secret-fallback-for-safety";
}

// Helper to import the crypto key for HMAC-SHA256
async function getCryptoKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  return await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

// Sign a username to create a signed session cookie value
export async function signSession(username: string): Promise<string> {
  const secret = getSessionSecret();
  const key = await getCryptoKey(secret);
  const encoder = new TextEncoder();
  const data = encoder.encode(username);
  const signature = await crypto.subtle.sign("HMAC", key, data);

  // Convert signature to hex
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${username}.${hashHex}`;
}

// Verify a signed session cookie value and return the username if valid
export async function verifySession(signedValue: string): Promise<string | null> {
  if (!signedValue) return null;
  const parts = signedValue.split(".");
  if (parts.length !== 2) return null;
  const [username, hexSignature] = parts;

  const secret = getSessionSecret();
  const key = await getCryptoKey(secret);
  const encoder = new TextEncoder();
  const data = encoder.encode(username);

  // Convert hex signature back to Uint8Array safely
  if (!/^[0-9a-fA-F]+$/.test(hexSignature)) {
    return null;
  }
  const sigBytes = new Uint8Array(
    hexSignature.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
  );

  const isValid = await crypto.subtle.verify("HMAC", key, sigBytes, data);
  return isValid ? username : null;
}

// The isAuthenticated interrupter gating /dashboard
export async function isAuthenticated({ request, ctx }: any) {
  const cookieHeader = request.headers.get("Cookie");
  const cookies = parseCookies(cookieHeader);
  const sessionCookie = cookies["session"];

  if (!sessionCookie) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/login",
      },
    });
  }

  const username = await verifySession(sessionCookie);
  if (!username) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/login",
      },
    });
  }

  // Set the username on ctx so downstream handlers can see it
  ctx.username = username;
}
