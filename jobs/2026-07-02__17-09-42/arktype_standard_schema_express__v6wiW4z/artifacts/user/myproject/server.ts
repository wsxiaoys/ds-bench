import express, {
  type Request,
  type Response,
  type NextFunction,
  type RequestHandler,
} from "express";
import { type } from "arktype";

// ---------------------------------------------------------------------------
// ArkType schemas (Standard Schema compliant via the `~standard` getter)
// ---------------------------------------------------------------------------

// POST /users body schema:
//   username : string, alphanumeric, length 3..20
//   email    : valid email
//   age      : optional integer in [13, 120]
//
// Cast the literal schema object to `any` because ArkType's deeply-recursive
// type definitions can confuse TS into a "must have strict" cycle here.
// Runtime semantics are unaffected -- we still get the standard-schema-
// compliant Type back with `~standard.validate` available.
const userBodySchema = type({
  username: "/^[a-zA-Z0-9]+$/ >= 3 <= 20",
  email: "string.email",
  age: "13 <= number.integer <= 120?",
} as any);

// GET /search query schema:
//   q    : string, length 1..100
//   page : integer >= 1   (coerced from query string)
//   limit: integer in [1, 50] (coerced from query string)
//
// Express delivers query values as strings, so each numeric field is piped
// through the built-in `string.integer.parse` morph before the numeric
// constraints are applied. This is a single declarative pipeline -- no
// hand-written JSON.parse / parseInt coercion.
const searchQuerySchema = type({
  q: "1 <= string <= 100",
  page: "string.integer.parse |> number >= 1",
  limit: "string.integer.parse |> 1 <= number <= 50",
} as any);

// ---------------------------------------------------------------------------
// Standard Schema middleware factory
// ---------------------------------------------------------------------------

/**
 * A minimal structural type for any object that satisfies the Standard Schema
 * v1 interface (https://standardschema.dev). We deliberately avoid importing
 * `@ark/schema`'s `StandardSchemaV1` so that this middleware stays vendor
 * neutral: it should work with any Standard-Schema-compliant validator.
 */
// Per the Standard Schema v1 spec, a successful result has a `value` and no
// (falsy) `issues`, while a failure result exposes an `issues` array.
interface StandardSuccess<Output> {
  readonly value: Output;
  readonly issues?: undefined;
}
interface StandardFailure {
  readonly issues: ReadonlyArray<{ readonly message: string }>;
}
type StandardResult<Output> = StandardSuccess<Output> | StandardFailure;

interface StandardSchema<Input = unknown, Output = Input> {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (
      value: unknown,
    ) => StandardResult<Output> | Promise<StandardResult<Output>>;
  };
}

type Source = "body" | "query";

/**
 * Express middleware factory that validates `req[source]` against a
 * Standard-Schema-compliant schema via the `~standard.validate` interface.
 *
 * On success: replaces `req[source]` with the (possibly coerced) output value
 * and calls `next()`.
 * On failure: responds with HTTP 400 and `{ issues: [{ message }, ...] }`.
 */
function validate<Output>(
  source: Source,
  schema: StandardSchema<unknown, Output>,
): RequestHandler {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      // Drive validation exclusively through the Standard Schema interface.
      const result = await schema["~standard"].validate(req[source]);

      if ("issues" in result && result.issues) {
        // Coerce to a plain array first: some implementations (e.g. ArkType's
        // ArkErrors) override `.map` in a way that doesn't work with a plain
        // mapper function. `Array.from` materialises a real array that
        // honours the Standard Schema `Issue` shape.
        const issueList = Array.from(result.issues);
        res.status(400).json({
          issues: issueList.map((issue) => ({
            message: issue.message,
          })),
        });
        return;
      }

      // Success: assign the validated/coerced value back onto req[source].
      // We need to mutate the express request property here, so cast through
      // `unknown` to satisfy TS's structural typing of the property bag.
      (req as unknown as Record<Source, unknown>)[source] = (
        result as { value: Output }
      ).value;
      next();
    } catch (err) {
      next(err);
    }
  };
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());

// POST /users: validate body against `userBodySchema`
app.post(
  "/users",
  validate("body", userBodySchema),
  (req, res) => {
    // req.body has been replaced with the validated/coerced value.
    res.status(201).json(req.body);
  },
);

// GET /search: validate query against `searchQuerySchema`
app.get(
  "/search",
  validate("query", searchQuerySchema),
  (req, res) => {
    // req.query has been replaced with the validated/coerced value, with
    // page/limit now real numbers (not strings).
    res.status(200).json(req.query);
  },
);

const PORT = 3000;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${PORT}`);
});