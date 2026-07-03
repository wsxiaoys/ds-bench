import { api } from "encore.dev/api";
import { graphql, buildSchema } from "graphql";
import { json } from "node:stream/consumers";

const schema = buildSchema(`
  type Query {
    hello(name: String): String!
  }
`);

const rootValue = {
  hello: ({ name }: { name?: string }) => {
    return `Hello, ${name || "World"}!`;
  },
};

export const graphqlAPI = api.raw(
  { expose: true, path: "/graphql", method: "POST" },
  async (req, res) => {
    try {
      const payload: any = await json(req);
      const query = payload?.query;
      const variables = payload?.variables;
      const operationName = payload?.operationName;

      if (!query) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ errors: [{ message: "Must provide query string." }] }));
        return;
      }

      const result = await graphql({
        schema,
        source: query,
        rootValue,
        variableValues: variables,
        operationName,
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (err: any) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ errors: [{ message: err.message || "Invalid JSON or request" }] }));
    }
  }
);
