import express from "express";
import { type } from "arktype";
// Schema for POST /users body.
//   username: alphanumeric string of length 3..20 (one bound per `|>` step).
//   email: a well-formed email address.
//   age: optional integer in [13, 120].
const UserBodySchema = type({
    username: "string.alphanumeric |> (string >= 3) |> (string <= 20)",
    email: "string.email",
    age: "number.integer |> (number >= 13) |> (number <= 120)?"
});
// Schema for GET /search query.
//   Express delivers query values as strings, so `page` and `limit` must be
//   coerced from strings to numbers via ArkType morphs (`string.numeric.parse`)
//   composed with their numeric bounds using the `|>` declarative pipeline.
const SearchQuerySchema = type({
    q: "string >= 1 |> (string <= 100)",
    page: "string.numeric.parse |> (number >= 1)",
    limit: "string.numeric.parse |> (1 <= number <= 50)"
});
// Reusable middleware factory that drives validation exclusively through the
// Standard Schema interface (i.e. `schema["~standard"].validate(...)`).
function validate(source, schema) {
    return async (req, res, next) => {
        try {
            const result = await schema["~standard"].validate(req[source]);
            if (result.issues) {
                res.status(400).json({
                    issues: Array.from(result.issues).map((issue) => ({
                        message: issue.message
                    }))
                });
                return;
            }
            // Success: replace `req[source]` with the validated/coerced value.
            req[source] = result.value;
            next();
        }
        catch (err) {
            next(err);
        }
    };
}
const app = express();
app.use(express.json());
app.post("/users", validate("body", UserBodySchema), (req, res) => {
    res.status(201).json(req.body);
});
app.get("/search", validate("query", SearchQuerySchema), (req, res) => {
    res.status(200).json(req.query);
});
app.listen(3000, () => {
    console.log("Server listening on port 3000");
});
