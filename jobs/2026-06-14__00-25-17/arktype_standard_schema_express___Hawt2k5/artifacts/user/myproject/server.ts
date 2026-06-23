import express from "express";
import { type } from "arktype";

// Body schema for POST /users
const userBodySchema = type({
  username: "3 <= string.alphanumeric <= 20",
  email: "string.email",
  "age?": "13 <= number.integer <= 120",
});

// Query schema for GET /search
// Express query values arrive as strings, so we use ArkType morphs
// (string.integer.parse) to coerce strings to numbers in a single
// declarative pipeline — no JSON.parse, parseInt, or hand-written coercion.
const searchQuerySchema = type({
  q: "1 <= string <= 100",
  page: type("string.integer.parse").to("number >= 1"),
  limit: type("string.integer.parse").to("1 <= number <= 50"),
});

// Reusable middleware factory that drives validation exclusively through
// the Standard Schema interface (schema["~standard"].validate).
function validate(
  source: "body" | "query",
  schema: { "~standard": { validate: (value: unknown) => unknown } }
) {
  return async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const result: any = await schema["~standard"].validate(req[source]);
    if (result.issues) {
      res.status(400).json({ issues: result.issues });
    } else {
      (req as any)[source] = result.value;
      next();
    }
  };
}

const app = express();
app.use(express.json());

app.post("/users", validate("body", userBodySchema), (req, res) => {
  res.status(201).json(req.body);
});

app.get("/search", validate("query", searchQuerySchema), (req, res) => {
  res.json(req.query);
});

app.listen(3000, () => {
  console.log("Server listening on port 3000");
});