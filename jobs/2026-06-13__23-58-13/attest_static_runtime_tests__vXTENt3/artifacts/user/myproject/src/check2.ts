import { type } from "arktype"

export const role = type("'admin' | 'user' | 'guest'")
export type Role = typeof role.infer
