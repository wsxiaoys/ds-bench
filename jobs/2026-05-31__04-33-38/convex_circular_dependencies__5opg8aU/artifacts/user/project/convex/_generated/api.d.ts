import type { ApiFromModules } from "convex/server";
import type * as a from "../a.js";
import type * as b from "../b.js";
import type * as c from "../c.js";

export declare const api: ApiFromModules<{
  a: typeof a;
  b: typeof b;
  c: typeof c;
}>;
