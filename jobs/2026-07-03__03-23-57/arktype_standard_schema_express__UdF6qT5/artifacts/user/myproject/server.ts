import express, { Request, Response, NextFunction } from "express";
import { type } from "arktype";

// Initialize Express app
const app = express();
app.use(express.json());

// Define ArkType Schemas
// POST /users body schema
// username: alphanumeric, length 3..20
// email: valid email
// age: optional integer in [13, 120]
export const userBodySchema = type({
  username: "3 <= string.alphanumeric <= 20",
  email: "string.email",
  "age?": "13 <= number.integer <= 120",
});

// GET /search query schema
// q: string, length 1..100
// page: integer >= 1, coerced from string
// limit: integer in [1, 50], coerced from string
export const searchQuerySchema = type({
  q: "1 <= string <= 100",
  page: type("string.integer.parse").to("number >= 1"),
  limit: type("string.integer.parse").to("1 <= number <= 50"),
});

// Reusable middleware factory
export function validate(source: "body" | "query", schema: any) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!schema || !("~standard" in schema)) {
        return res.status(500).json({ error: "Invalid schema provided to validate middleware" });
      }

      const input = req[source];
      // Drive validation exclusively through the Standard Schema interface
      const result = await schema["~standard"].validate(input);

      if (result.issues) {
        // Map issues and return 400
        const issues = [...result.issues].map((issue: any) => ({
          message: issue.message,
        }));
        return res.status(400).json({ issues });
      }

      // Replace req[source] with the validated/coerced value
      req[source] = result.value;
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Routes
app.post("/users", validate("body", userBodySchema), (req: Request, res: Response) => {
  res.status(201).json(req.body);
});

app.get("/search", validate("query", searchQuerySchema), (req: Request, res: Response) => {
  res.status(200).json(req.query);
});

// Start the server if this file is run directly
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
