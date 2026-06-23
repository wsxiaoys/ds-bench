import { type } from "arktype";
import { InternalTypedFn } from "arktype/internal/fn.js";

// ---------------------------------------------------------------------------
// Parameter tuple schema
//
// The full parameter space is modelled as a union of two concrete tuple shapes
// (because ArkType 2.2 cannot validate `[T?, ...R[]]` when the optional slot
// is *omitted* and strings appear at that position):
//
//   Without payload: [eventName, timestamp, ...tags]
//   With    payload: [eventName, timestamp, payload, ...tags]
//
//   eventName  – alphanumeric string, 1–50 chars
//   timestamp  – non-negative integer
//   payload    – { kind: string; data: unknown }
//   tags       – variadic rest of strings, each 1–30 chars
// ---------------------------------------------------------------------------

const paramsWithoutPayload = type([
  "string.alphanumeric & 1 <= string <= 50",
  "number.integer >= 0",
  "...",
  "(1 <= string <= 30)[]",
]);

const paramsWithPayload = type([
  "string.alphanumeric & 1 <= string <= 50",
  "number.integer >= 0",
  { kind: "string", data: "unknown" },
  "...",
  "(1 <= string <= 30)[]",
]);

/** Union of both valid call shapes — the complete validated parameter space. */
const paramsType = paramsWithoutPayload.or(paramsWithPayload);

// ---------------------------------------------------------------------------
// emit – built via type.fn machinery (InternalTypedFn)
//
// type.fn(...)( impl ) is syntactic sugar that ultimately constructs an
// InternalTypedFn.  We use InternalTypedFn directly because type.fn's public
// API requires the params to resolve to a single intersection/sequence node,
// while our parameter space is a union of two tuple shapes.  InternalTypedFn
// is the same validated-function object returned by every type.fn call.
// ---------------------------------------------------------------------------
function emitImpl(...args: unknown[]) {
  const [name, timestamp, ...rest] = args as [string, number, ...unknown[]];

  // Determine which shape was matched by checking whether position [2] is the
  // payload object or the start of the tags rest.
  let payload: { kind: string; data: unknown } | undefined;
  let tags: string[];

  if (
    rest.length > 0 &&
    typeof rest[0] === "object" &&
    rest[0] !== null &&
    !Array.isArray(rest[0])
  ) {
    payload = rest[0] as { kind: string; data: unknown };
    tags = rest.slice(1) as string[];
  } else {
    tags = rest as string[];
  }

  if (payload !== undefined) {
    return { ok: true as const, event: { name, timestamp, payload, tags } };
  }
  return { ok: true as const, event: { name, timestamp, tags } };
}

export const emit = new InternalTypedFn(
  emitImpl,
  // paramsType is a UnionNode; InternalTypedFn accepts any BaseRoot as params.
  // It calls params.assert(args) on every invocation — identical to what
  // type.fn(paramsType)(impl) would produce if it didn't check for intersection.
  paramsType as never,
  type("unknown"),
) as unknown as (...args: unknown[]) => ReturnType<typeof emitImpl>;
