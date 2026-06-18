import { api } from "encore.dev/api";
import { graphql as executeGraphQL, buildSchema } from "graphql";

const schema = buildSchema(`
  type Query {
    hello(name: String): String!
  }
`);

const rootValue = {
  hello: ({ name }: { name?: string }) => `Hello, ${name || "World"}!`,
};

export const graphql = api.raw(
  { expose: true, path: "/graphql", method: "POST" },
  async (req) => {
    let query: string = "";
    let variables: any = {};

    const rb = req.body as any;
    if (rb && rb.query) {
      query = rb.query;
      variables = rb.variables;
    } else {
      try {
        const bodyText = await new Response(req.body as any).text();
        if (bodyText && bodyText !== "[object Object]") {
          const parsed = JSON.parse(bodyText);
          query = parsed.query;
          variables = parsed.variables;
        } else if (bodyText === "[object Object]") {
          // Already parsed but not picked up by rb.query?
          query = rb.query;
          variables = rb.variables;
        }
      } catch (e) {
        // Ignore
      }
    }

    const result = await executeGraphQL({
      schema,
      source: query,
      variableValues: variables,
      rootValue,
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    };
  }
);
