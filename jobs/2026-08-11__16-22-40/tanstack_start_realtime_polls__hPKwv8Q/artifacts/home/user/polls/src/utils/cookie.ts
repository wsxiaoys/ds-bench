export function parseCookies(cookieHeader: string | null | undefined): Record<string, string> {
  const cookies: Record<string, string> = {}
  if (!cookieHeader) return cookies
  const parts = cookieHeader.split(';')
  for (const part of parts) {
    const [key, ...valueParts] = part.split('=')
    if (key) {
      cookies[key.trim()] = valueParts.join('=').trim()
    }
  }
  return cookies
}

export function serializeCookie(
  name: string,
  value: string,
  options: { maxAge?: number; path?: string } = {}
): string {
  const parts = [`${name}=${value}`]
  if (options.path) {
    parts.push(`Path=${options.path}`)
  } else {
    parts.push('Path=/')
  }
  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`)
  } else {
    // Default to 1 year
    parts.push('Max-Age=31536000')
  }
  parts.push('HttpOnly')
  return parts.join('; ')
}
