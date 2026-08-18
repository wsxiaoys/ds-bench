export function parseTags(tagsStr: string): string[] {
  return tagsStr
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0);
}
