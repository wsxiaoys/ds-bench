import { scope } from "arktype";
const s = scope({ slug: "/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/ >= 3 <= 64" }).export();

const tests = [
  "abc", "a-b", "ab-c", "ab--c", "a", "ab", "-abc", "abc-", "A-bc", "ab_c",
  "a".repeat(64), "a".repeat(65)
];
for (const t of tests) {
  try {
    s.slug.assert(t);
    console.log(`VALID: ${t}`);
  } catch (e: any) {
    console.log(`INVALID: ${t} -> ${e.message}`);
  }
}
