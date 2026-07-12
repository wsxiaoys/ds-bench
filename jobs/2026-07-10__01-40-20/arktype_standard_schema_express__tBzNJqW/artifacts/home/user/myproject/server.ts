import express, { type Request, type Response, type NextFunction, type RequestHandler } from "express"
import { type } from "arktype"

/* -------------------------------------------------------------------------- */
/*  Standard Schema interface (vendor-neutral)                                */
/* -------------------------------------------------------------------------- */

/**
 * A minimal, vendor-neutral representation of the Standard Schema spec.
 *
 * See https://standardschema.dev — every compliant schema exposes a
 * `~standard` property whose `validate(value)` method returns either a
 * success result (with a `value`) or a failure result (with an `issues`
 * array). The middleware below drives validation *exclusively* through
 * this interface, so it works with ArkType, Zod, Valibot, or any other
 * library that implements the spec.
 */
interface StandardSchema {
    readonly "~standard": {
        readonly version: 1
        readonly vendor: string
        readonly validate: (
            value: unknown
        ) => StandardResult | Promise<StandardResult>
    }
}

type StandardResult =
    | { readonly value: unknown; readonly issues?: undefined }
    | { readonly issues: ReadonlyArray<StandardIssue> }

interface StandardIssue {
    readonly message: string
    readonly path?:
        | ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>
        | undefined
}

/* -------------------------------------------------------------------------- */
/*  Reusable validation middleware factory                                     */
/* -------------------------------------------------------------------------- */

type RequestSource = "body" | "query"

/**
 * Creates an Express middleware that validates `req[source]` against any
 * object implementing the Standard Schema interface.
 *
 * Validation is driven *only* through `schema["~standard"].validate(...)` —
 * no library-specific APIs (e.g. ArkType's `.assert()` or direct invocation)
 * are used, so the middleware remains schema-agnostic.
 *
 * On success the validated/coerced value replaces `req[source]` and `next()`
 * is called. On failure a `400` response is sent with a JSON body of the
 * shape `{ issues: [{ message: string }] }`.
 */
function validate<S extends StandardSchema>(
    source: RequestSource,
    schema: S
): RequestHandler {
    return async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        // Drive validation exclusively through the Standard Schema interface.
        // The `~standard` property is referenced literally here.
        const result = await schema["~standard"].validate(req[source])

        if (result.issues) {
            // Build a *plain* Array (Array.from ignores Array[Symbol.species],
            // so this is never an ArkErrors — whose toJSON() would otherwise
            // assume every element is an ArkError).
            const issues = Array.from(result.issues, issue => ({
                message: issue.message
            }))
            res.status(400).json({ issues })
            return
        }

        // Replace the request value with the validated / coerced output.
        ;(req as unknown as Record<string, unknown>)[source] = result.value
        next()
    }
}

/* -------------------------------------------------------------------------- */
/*  ArkType schemas                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Body schema for `POST /users`.
 *
 *  - `username`: alphanumeric string, length 3..20
 *  - `email`:    a valid email address
 *  - `age`:      optional integer in [13, 120]
 */
const userBodySchema = type({
    username: "3 <= string.alphanumeric <= 20",
    email: "string.email",
    "age?": "13 <= number.integer <= 120"
})

/**
 * Query schema for `GET /search`.
 *
 * Express delivers every query value as a string, so `page` and `limit`
 * are coerced from string to number via a declarative ArkType morph
 * pipeline (`string.numeric.parse |>`). No hand-written coercion
 * (`parseInt`, `JSON.parse`, `Number(...)`, …) is used anywhere.
 *
 *  - `q`:     string, length 1..100
 *  - `page`:  integer >= 1   (coerced from string)
 *  - `limit`: integer in [1, 50] (coerced from string)
 */
const searchQuerySchema = type({
    q: "1 <= string <= 100",
    page: ["string.numeric.parse", "|>", "number.integer >= 1"],
    limit: ["string.numeric.parse", "|>", "1 <= number.integer <= 50"]
})

/* -------------------------------------------------------------------------- */
/*  Express application                                                        */
/* -------------------------------------------------------------------------- */

const app = express()

// Parse JSON request bodies for POST routes.
app.use(express.json())

// POST /users — validate the request body, then echo the validated user.
app.post(
    "/users",
    validate("body", userBodySchema),
    (req: Request, res: Response): void => {
        // req.body is now the validated (and possibly coerced) user object.
        res.status(201).json({ user: req.body })
    }
)

// GET /search — validate the query string, then echo the coerced query.
app.get(
    "/search",
    validate("query", searchQuerySchema),
    (req: Request, res: Response): void => {
        // req.query now contains numeric `page` and `limit`.
        res.status(200).json({ query: req.query })
    }
)

const PORT = 3000

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`)
})

export { app, validate, userBodySchema, searchQuerySchema }