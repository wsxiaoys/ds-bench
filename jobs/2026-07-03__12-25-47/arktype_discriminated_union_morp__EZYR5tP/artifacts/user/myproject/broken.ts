// Intentionally broken: a union with no discriminator that applies different
// morphs to the `value` field. ArkType refuses to parse this because the union
// branches are indistinguishable and could apply different morphs to the same
// data.
import { type } from "arktype";

const BrokenSchema = type({
  value: "string"
})
  .pipe((data) => ({ ...data, value: Number(data.value) }))
  .or(type({ value: "string" }).pipe((data) => ({ ...data, value: data.value.toUpperCase() })));

// Even calling this triggers the ParseError at definition time, but we also
// parse an input so the error definitely propagates.
const result = BrokenSchema({ value: "42" });
console.log(result);
