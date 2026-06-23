import express, { Request, Response, NextFunction } from "express";
import { type } from "arktype";

// ---------------------------------------------------------------------------
// ArkType schemas
// ---------------------------------------------------------------------------

/**
 * Body schema for POST /users
 *   - username: alphanumeric, length 3..20
 *   - email:    valid email address
 *   - age?:     integer in [13, 120]  (optional)
 */
const userBodySchema = type({
  username: "string.alphanumeric & string >= 3 & string <= 20",
  email: "string.email",
  "age?": "number.integer >= 13 & number.integer <= 120",
});

/**
 * Query schema for GET /search
 *   - q:     string, length 1..100
 *   - page:  integer >= 1  (coerced from query string)
 *   - limit: integer in [1, 50]  (coerced from query string)
 *
 * Express delivers query values as strings, so we pipe through ArkType's
 * built-in `string.integer.parse` morph to coerce them before applying the
 * numeric constraints.  No hand-written parseInt/JSON.parse is used.
 */
const searchQuerySchema = type({
  q: "string >= 1 & string <= 100",
  page: type("string.integer.parse").pipe(type("number.integer >= 1")),
  limit: type("string.integer.parse").pipe(
    type("number.integer >= 1 & number.integer <= 50")
  ),
});

// ---------------------------------------------------------------------------
// Standard Schema middleware factory
// ---------------------------------------------------------------------------

/**
 * A Standard Schema-compliant object exposes a `~standard` property whose
 * `validate` method returns either `{ value }` (success) or `{ issues }` (failure).
 * This interface matches StandardSchemaV1 from https://standardschema.dev.
 */
interface StandardSchemaV1 {
  readonly "~standard": {
    readonly validate: (
      value: unknown
    ) => { value: unknown; issues?: undefined } | { issues: ReadonlyArray<{ message: string }> } | Promise<{ value: unknown; issues?: undefined } | { issues: ReadonlyArray<{ message: string }> }>;
  };
}

/**
 * Middleware factory that validates `req[source]` through the Standard Schema
 * interface (`schema["~standard"].validate(...)`).
 *
 * On success  → replaces `req[source]` with the validated/coerced value and calls next().
 * On failure  → responds 400 with `{ issues: [...] }`.
 *
 * The factory is intentionally schema-agnostic: it will work with any object
 * that satisfies the Standard Schema interface, regardless of the library that
 * produced it.
 */
function validate(source: "body" | "query", schema: StandardSchemaV1) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Drive validation exclusively through the Standard Schema interface.
    // The literal string "~standard" must appear here per the spec.
    const result = await schema["~standard"].validate(req[source]);

    if (result.issues) {
      res.status(400).json({ issues: result.issues });
      return;
    }

    // Replace the source with the validated (and potentially coerced) value.
    (req as Record<string, unknown>)[source] = result.value;
    next();
  };
}

// ---------------------------------------------------------------------------
// Express application
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());

/**
 * POST /users
 * Validates the JSON body against userBodySchema.
 * 201 → echoes the validated user object.
 * 400 → { issues: [...] }
 */
app.post(
  "/users",
  validate("body", userBodySchema),
  (req: Request, res: Response) => {
    res.status(201).json(req.body);
  }
);

/**
 * GET /search?q=...&page=...&limit=...
 * Validates and coerces the query params against searchQuerySchema.
 * 200 → echoes { q, page, limit } with page and limit as numbers.
 * 400 → { issues: [...] }
 */
app.get(
  "/search",
  validate("query", searchQuerySchema),
  (req: Request, res: Response) => {
    res.status(200).json(req.query);
  }
);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
