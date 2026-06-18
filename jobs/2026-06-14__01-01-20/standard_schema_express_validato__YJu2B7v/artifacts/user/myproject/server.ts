import express, { type Request, type Response, type NextFunction } from "express";
import { type } from "arktype";

// ─── Schemas ───────────────────────────────────────────────────────────────

const userBodySchema = type({
  username: "string.alphanumeric & string >= 3 & string <= 20",
  email: "string.email",
  "age?": "number.integer >= 13 <= 120",
});

const searchQuerySchema = type({
  q: "string >= 1 <= 100",
  page: "(string |> number) & number.integer >= 1",
  limit: "(string |> number) & number.integer >= 1 <= 50",
});

// ─── Middleware factory ────────────────────────────────────────────────────

function validate(
  source: "body" | "query",
  schema: { "~standard": { validate: (value: unknown) => any } }
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const result = await schema["~standard"].validate(req[source]);

    if (result.issues) {
      res.status(400).json({ issues: result.issues });
      return;
    }

    req[source] = result.value;
    next();
  };
}

// ─── App ───────────────────────────────────────────────────────────────────

const app = express();

app.use(express.json());

app.post("/users", validate("body", userBodySchema), (req: Request, res: Response) => {
  res.status(201).json(req.body);
});

app.get("/search", validate("query", searchQuerySchema), (req: Request, res: Response) => {
  res.json(req.query);
});

app.listen(3000, () => {
  console.log("Server listening on port 3000");
});
