import express, { Request, Response, NextFunction } from "express";
import { type } from "arktype";

// Initialize express application
const app = express();
app.use(express.json());

// Define ArkType schema for POST /users body
const userBodySchema = type({
  username: "string.alphanumeric>=3<=20",
  email: "string.email",
  "age?": "number.integer>=13<=120"
});

// Define ArkType schema for GET /search query
// q must be string of length 1..100
// page and limit must be coerced from string to integer using ArkType morphs
const searchQuerySchema = type({
  q: "string>=1<=100",
  page: "string.integer.parse|>number.integer>=1",
  limit: "string.integer.parse|>number.integer>=1<=50"
});

/**
 * Reusable middleware factory validate(source, schema)
 * Source can be 'body' or 'query'
 * Drives validation exclusively through the Standard Schema interface (~standard)
 */
export function validate(source: "body" | "query", schema: any) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const standardSchema = schema["~standard"];
      if (!standardSchema) {
        return res.status(500).json({
          issues: [{ message: "Invalid schema provided: missing ~standard property" }]
        });
      }

      // Treat validate as potentially asynchronous
      const result = await standardSchema.validate(req[source]);

      if (result.issues) {
        return res.status(400).json({ issues: result.issues });
      }

      // Replace req[source] with validated and coerced value
      req[source] = result.value as any;
      next();
    } catch (err: any) {
      return res.status(400).json({
        issues: [{ message: err.message || "Validation failed" }]
      });
    }
  };
}

// POST /users endpoint
app.post("/users", validate("body", userBodySchema), (req: Request, res: Response) => {
  res.status(201).json(req.body);
});

// GET /search endpoint
app.get("/search", validate("query", searchQuerySchema), (req: Request, res: Response) => {
  res.status(200).json(req.query);
});

// Start the server
const PORT = 3000;
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export { app, server };
