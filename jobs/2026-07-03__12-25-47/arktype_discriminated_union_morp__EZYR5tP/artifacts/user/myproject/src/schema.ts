import { type } from "arktype";

// Discriminated union where each branch has a different 'kind' literal.
// Because the discriminator makes the branches unambiguous, ArkType can safely
// apply different morphs to the same `value` field across branches.
export const PayloadSchema = type({
  kind: "'int'",
  value: "string"
}).pipe((data) => ({
  ...data,
  value: Number(data.value)
})).or({
  kind: "'raw'",
  value: "string"
});
