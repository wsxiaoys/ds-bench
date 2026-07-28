// Server-side upload validation constants.
// These are enforced on every upload request regardless of any client-side checks.

export const MAX_FILE_SIZE = 2097152 // 2 MiB, in bytes

export const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
] as const

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number]

export function isAllowedMimeType(mime: string): mime is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mime)
}
