import { api } from "encore.dev/api";
import { graphql, buildSchema } from "graphql";

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

export const graphqlHandler = api.raw(
  { expose: true, path: "/graphql", method: "POST" },
  async (req, res) => {
    console.log("Received request", req.method, req.url);
    let body = "";
    req.on("data", (chunk) => {
      console.log("Chunk:", chunk.toString());
      body += chunk.toString();
    });
    req.on("end", async () => {
      console.log("Body:", body);
      try {
        const { query, variables } = JSON.parse(body);
        const response = await graphql({
          schema,
          source: query,
          rootValue,
          variableValues: variables,
        });
        res.setHeader("Content-Type", "application/json");
        res.writeHead(200);
        res.end(JSON.stringify(response));
      } catch (err) {
        console.error(err);
        res.writeHead(400);
        res.end(JSON.stringify({ errors: [{ message: (err as Error).message }] }));
      }
    });
  }
);
