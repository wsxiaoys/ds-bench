import { type } from "arktype"

const branch1 = type({
  kind: "'int'",
  value: "string"
}).pipe((data) => ({
  kind: "int" as const,
  value: parseInt(data.value, 10)
}))

const branch2 = type({
  kind: "'raw'",
  value: "string"
})

export const PayloadSchema = branch1.or(branch2)
