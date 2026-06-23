import { match, type } from "arktype";

/**
 * Match-based event router built with ArkType 2.2.0.
 *
 * Cases (in order):
 *  1. bare string          → "text:<length>"
 *  2. bare number          → "num:<value>"
 *  3. string[]             → "list:<length>"
 *  4. click / button       → "btn:<target.id>"
 *  5. click / link         → "link:<target.href>"  (href validated as string.url)
 *  6. submit               → "submit:<formId>:<valid>"
 *  default: "assert"       → throws TraversalError for any unmatched event
 *
 * Cases 1-3 use the object-literal shorthand (primitive/array type strings are
 * embeddable as record keys).  Cases 4-6 use the fluent .case() API because
 * object shapes cannot be embedded as record-key strings in the match() call.
 */
export const route = match({
  // ── 1. bare string ────────────────────────────────────────────────────────
  string: (s) => `text:${s.length}`,

  // ── 2. bare number ────────────────────────────────────────────────────────
  number: (n) => `num:${n}`,

  // ── 3. string array ───────────────────────────────────────────────────────
  "string[]": (arr) => `list:${arr.length}`,
})
  // ── 4. click event – button target ────────────────────────────────────────
  //    Discriminates on kind === 'click' AND target.type === 'button'
  .case(
    type({
      kind: "'click'",
      target: { type: "'button'", id: "string" },
    }),
    (e) => `btn:${e.target.id}`,
  )
  // ── 5. click event – link target ──────────────────────────────────────────
  //    Discriminates on kind === 'click' AND target.type === 'link'.
  //    href must be a syntactically valid URL (ArkType keyword: string.url).
  .case(
    type({
      kind: "'click'",
      target: { type: "'link'", href: "string.url" },
    }),
    (e) => `link:${e.target.href}`,
  )
  // ── 6. submit event ───────────────────────────────────────────────────────
  //    Discriminates on kind === 'submit' with a formId string and valid bool
  .case(
    type({
      kind: "'submit'",
      payload: { formId: "string", valid: "boolean" },
    }),
    (e) => `submit:${e.payload.formId}:${e.payload.valid}`,
  )
  // ── default: throw TraversalError for any unmatched event ─────────────────
  .default("assert");
