import { type } from "arktype"
type T = Parameters<ReturnType<typeof type>["configure"]>[0]
// I will write this to a file and check the tsc output or use ts-morph.
