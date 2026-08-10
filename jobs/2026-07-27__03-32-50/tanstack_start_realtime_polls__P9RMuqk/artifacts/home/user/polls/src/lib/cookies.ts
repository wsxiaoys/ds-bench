export const CLIENT_COOKIE_NAME = "poll_client_id";

export function parseClientId(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const eqIndex = part.indexOf("=");
    if (eqIndex === -1) continue;
    const key = part.slice(0, eqIndex).trim();
    if (key === CLIENT_COOKIE_NAME) {
      const value = part.slice(eqIndex + 1).trim();
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }
  return null;
}

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function buildClientIdSetCookie(clientId: string): string {
  return `${CLIENT_COOKIE_NAME}=${encodeURIComponent(
    clientId,
  )}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
}
