import { type } from "arktype"

export const intBranch = type({
  kind: "'int'",
  value: type("string").matching(/^\d+$/).pipe((s) => Number(s))
})

export const rawBranch = type({
  kind: "'raw'",
  value: "string"
})

export const PayloadSchema = intBranch.or(rawBranch)
