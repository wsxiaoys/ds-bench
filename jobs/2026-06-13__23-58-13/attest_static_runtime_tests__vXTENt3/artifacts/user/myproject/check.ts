import { type } from "arktype"

const role = type("'admin' | 'user' | 'guest'")
type Role = typeof role.infer
