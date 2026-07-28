import { marked } from 'marked'

marked.setOptions({
  gfm: true,
  breaks: false,
})

/**
 * Renders a Markdown string to an HTML string.
 */
export function renderMarkdown(markdown: string): string {
  return marked.parse(markdown, { async: false }) as string
}
