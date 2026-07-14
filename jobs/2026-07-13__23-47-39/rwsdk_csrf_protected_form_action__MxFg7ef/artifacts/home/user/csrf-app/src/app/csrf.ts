// CSRF helpers implementing the double-submit-cookie pattern.
//
// On GET / a fresh, cryptographically-strong token is generated, embedded in
// the rendered form as a hidden input, and simultaneously set as a cookie.
// On POST /submit the submitted form token is compared against the cookie
// token; the request is only accepted when both are present and equal.

export const CSRF_COOKIE = "csrf_token";
export const CSRF_FIELD = "csrf_token";

// Generate an unguessable per-request token using the Web Crypto API.
export function generateCsrfToken(): string {
  return crypto.randomUUID();
}

// Parse the `Cookie` request header into a simple key/value map.
function parseCookies(cookieHeader: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

// Run the double-submit-cookie validation against a `Request`.
//
// Returns `true` only when the form field named `csrf_token` is present, the
// `csrf_token` cookie is present, and the two values are strictly equal.
export async function validateCsrf(request: Request): Promise<boolean> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return false;
  }

  const formToken = formData.get(CSRF_FIELD);
  if (typeof formToken !== "string" || formToken.length === 0) {
    return false;
  }

  const cookies = parseCookies(request.headers.get("cookie"));
  const cookieToken = cookies[CSRF_COOKIE];
  if (typeof cookieToken !== "string" || cookieToken.length === 0) {
    return false;
  }

  // Constant-time-ish comparison to avoid timing leaks.
  return safeEqual(formToken, cookieToken);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// Extract the `message` field from a urlencoded body, returning `null` when
// it is absent or not a string.
export async function readMessage(request: Request): Promise<string | null> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return null;
  }
  const message = formData.get("message");
  if (typeof message !== "string") return null;
  return message;
}