import { api } from "encore.dev/api";
import { buildSchema, graphql as graphqlExecute } from "graphql";

// Define the GraphQL schema
const schema = buildSchema(`
  type Query {
    hello(name: String): String!
  }
`);

// Root resolver for the hello query
const rootResolver = {
  hello: ({ name }: { name?: string | null }) => {
    return `Hello, ${name || "World"}!`;
  },
};

// Raw endpoint that handles GraphQL POST requests
export const graphqlHandler = api.raw(
  { expose: true, path: "/graphql", method: "POST" },
  async (req, resp) => {
    // Read the request body
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk));
    }
    const bodyStr = Buffer.concat(chunks).toString("utf-8");

    let requestBody: { query?: string; variables?: Record<string, unknown> };
    try {
      requestBody = JSON.parse(bodyStr);
    } catch {
      resp.writeHead(400, { "Content-Type": "application/json" });
      resp.end(JSON.stringify({ errors: [{ message: "Invalid JSON body" }] }));
      return;
    }

    const { query, variables } = requestBody;

    if (!query) {
      resp.writeHead(400, { "Content-Type": "application/json" });
      resp.end(JSON.stringify({ errors: [{ message: "Missing 'query' field" }] }));
      return;
    }

    // Execute the GraphQL query
    const result = await graphqlExecute({
      schema,
      source: query,
      rootValue: rootResolver,
      variableValues: variables,
    });

    resp.writeHead(200, { "Content-Type": "application/json" });
    resp.end(JSON.stringify(result));
  },
);