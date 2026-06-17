import { api } from "encore.dev/api";
import { buildSchema, graphql as executeGraphql } from "graphql";

const schema = buildSchema(`
  type Query {
    hello(name: String): String!
  }
`);

const rootValue = {
  hello: ({ name }: { name?: string }) => `Hello, ${name ?? "World"}!`,
};

const readRequestBody = async (req: NodeJS.ReadableStream): Promise<string> => {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
  }
  return body;
};

export const graphql = api.raw(
  { expose: true, method: "POST", path: "/graphql" },
  async (req, res) => {
    try {
      const body = await readRequestBody(req);
      const { query, variables, operationName } = JSON.parse(body || "{}");

      if (!query) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ errors: [{ message: "Missing query" }] }));
        return;
      }

      const result = await executeGraphql({
        schema,
        source: query,
        variableValues: variables,
        operationName,
        rootValue,
      });

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
    } catch (error) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          errors: [
            {
              message: error instanceof Error ? error.message : "Invalid request",
            },
          ],
        })
      );
    }
  }
);
