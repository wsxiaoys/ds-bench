import { GraphQLSchema, GraphQLObjectType, GraphQLString, graphql } from "graphql";
import { api } from "encore.dev/api";

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: "Query",
    fields: {
      hello: {
        type: GraphQLString,
        args: {
          name: { type: GraphQLString },
        },
        resolve: (_source: unknown, args: { name?: string }) => {
          return `Hello, ${args.name ?? "World"}!`;
        },
      },
    },
  }),
});

interface GraphQLRequest {
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}

export const graphqlHandler = api.raw(
  { path: "/graphql", method: "POST", expose: true },
  async (req, res) => {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
    }

    const parsed: GraphQLRequest = JSON.parse(body);

    const result = await graphql({
      schema,
      source: parsed.query,
      variableValues: parsed.variables,
      operationName: parsed.operationName,
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  }
);