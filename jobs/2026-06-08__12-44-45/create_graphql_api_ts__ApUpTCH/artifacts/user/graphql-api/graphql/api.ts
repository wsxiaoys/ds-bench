import { api } from "encore.dev/api";
import { buildSchema, graphql } from "graphql";

// Define the GraphQL schema
const schema = buildSchema(`
  type Query {
    hello(name: String): String!
  }
`);

// Define resolvers
const rootValue = {
  hello: ({ name }: { name?: string }) => {
    return `Hello, ${name ?? "World"}!`;
  },
};

// Raw endpoint to handle GraphQL requests at /graphql
export const graphqlEndpoint = api.raw(
  { expose: true, method: "POST", path: "/graphql" },
  async (req, resp) => {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
    }

    let parsed: { query?: string; variables?: Record<string, unknown>; operationName?: string };
    try {
      parsed = JSON.parse(body);
    } catch {
      resp.writeHead(400, { "Content-Type": "application/json" });
      resp.end(JSON.stringify({ errors: [{ message: "Invalid JSON body" }] }));
      return;
    }

    const { query, variables, operationName } = parsed;

    if (!query) {
      resp.writeHead(400, { "Content-Type": "application/json" });
      resp.end(JSON.stringify({ errors: [{ message: "Missing query" }] }));
      return;
    }

    const result = await graphql({
      schema,
      source: query,
      rootValue,
      variableValues: variables,
      operationName,
    });

    resp.writeHead(200, { "Content-Type": "application/json" });
    resp.end(JSON.stringify(result));
  }
);
