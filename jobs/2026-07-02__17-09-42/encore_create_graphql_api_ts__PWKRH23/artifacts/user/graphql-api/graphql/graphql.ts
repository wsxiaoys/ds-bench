import { api } from "encore.dev/api";
import {
  buildSchema,
  graphql as graphqlExec,
  type GraphQLSchema,
  type ExecutionResult,
} from "graphql";

// GraphQL schema with a single `hello` query.
const typeDefs = /* GraphQL */ `
  type Query {
    """
    Returns a greeting for the provided name.
    If no name is provided, it returns a greeting for "World".
    """
    hello(name: String): String!
  }
`;

// Build a GraphQL schema from the type definitions.
const schema: GraphQLSchema = buildSchema(typeDefs);

// Resolver map. The `hello` query returns "Hello, <name>!" or "Hello, World!".
const rootValue = {
  hello: (args: { name?: string | null }): string => {
    const name = args.name && args.name.length > 0 ? args.name : "World";
    return `Hello, ${name}!`;
  },
};

// Maximum body size for incoming JSON payloads.
const MAX_BODY_SIZE = 1024 * 1024; // 1 MiB

// Helper: read the request body as a UTF-8 string while enforcing a max size.
function readBody(req: import("node:stream").Readable): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let aborted = false;

    req.on("data", (chunk: Buffer) => {
      if (aborted) return;
      total += chunk.length;
      if (total > MAX_BODY_SIZE) {
        aborted = true;
        reject(new Error("request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (aborted) return;
      resolve(Buffer.concat(chunks).toString("utf8"));
    });

    req.on("error", (err) => {
      if (aborted) return;
      aborted = true;
      reject(err);
    });
  });
}

// Helper: send a JSON response with the given status code.
function sendJson(
  res: import("node:http").ServerResponse,
  status: number,
  body: unknown,
): void {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Length", Buffer.byteLength(payload));
  res.end(payload);
}

// Encore raw endpoint that handles GraphQL POST requests at /graphql.
// Using `api.raw` lets us accept the full HTTP request (including the body)
// and return a raw response, which is what GraphQL clients expect.
export const graphqlHandler = api.raw(
  { expose: true, path: "/graphql", method: "POST" },
  async (req, res): Promise<void> => {
    try {
      // Read the request body (standard GraphQL JSON payload).
      const raw = await readBody(req);

      let payload: unknown;
      try {
        payload = JSON.parse(raw);
      } catch {
        sendJson(res, 400, { errors: [{ message: "invalid JSON body" }] });
        return;
      }

      if (
        !payload ||
        typeof payload !== "object" ||
        typeof (payload as { query?: unknown }).query !== "string"
      ) {
        sendJson(res, 400, {
          errors: [{ message: "missing or invalid `query` field in request body" }],
        });
        return;
      }

      const body = payload as {
        query: string;
        operationName?: string | null;
        variables?: Record<string, unknown> | null;
      };

      // Execute the GraphQL query against our schema.
      const result: ExecutionResult = await graphqlExec({
        schema,
        source: body.query,
        rootValue,
        variableValues: body.variables ?? undefined,
        operationName: body.operationName ?? undefined,
      });

      sendJson(res, 200, result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "internal server error";
      sendJson(res, 500, { errors: [{ message }] });
    }
  },
);
