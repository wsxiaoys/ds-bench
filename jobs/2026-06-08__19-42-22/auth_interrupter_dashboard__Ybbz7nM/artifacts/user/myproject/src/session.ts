import { env } from "cloudflare:workers";

export async function signCookie(value: string): Promise<string> {
  const secret = env.SESSION_SECRET || (typeof process !== 'undefined' ? process.env.SESSION_SECRET : null) || (typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env.SESSION_SECRET : null) || "fallback_secret";
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return `${value}.${signatureBase64}`;
}

export async function verifyCookie(cookieValue: string): Promise<string | null> {
  const secret = env.SESSION_SECRET || (typeof process !== 'undefined' ? process.env.SESSION_SECRET : null) || (typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env.SESSION_SECRET : null) || "fallback_secret";
  const parts = cookieValue.split('.');
  if (parts.length !== 2) return null;
  const [value, signatureBase64] = parts;
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  
  try {
    const signatureStr = atob(signatureBase64);
    const signature = new Uint8Array(signatureStr.length);
    for (let i = 0; i < signatureStr.length; i++) {
      signature[i] = signatureStr.charCodeAt(i);
    }
    
    const isValid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(value));
    return isValid ? value : null;
  } catch (e) {
    return null;
  }
}

export function parseCookies(cookieHeader: string | null) {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    const name = parts[0].trim();
    const value = parts.slice(1).join('=').trim();
    cookies[name] = value;
  });
  return cookies;
}
