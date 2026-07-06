import { api } from "encore.dev/api";
import { json, text } from "node:stream/consumers";

export const graphql = api.raw(
  { expose: true, method: "*", path: "/graphql" },
  async (req: any, resp: any) => {
    try {
      if (!req || !resp) return;
      const contentType = (req.headers["content-type"] ?? "") as string;
      let bodyText = "";
      if (contentType.includes("application/graphql")) {
        bodyText = (await text(req)) as string;
      } else {
        const payload = (await json(req)) as any;
        bodyText = JSON.stringify(payload);
      }
      resp.statusCode = 200;
      resp.setHeader("Content-Type", "application/json");
      resp.end(JSON.stringify({ ok: true, body: bodyText }));
    } catch (err) {
      console.log("ERR:", err);
      if (resp && resp.statusCode !== undefined) {
        resp.statusCode = 500;
        resp.end(JSON.stringify({ error: String(err) }));
      }
    }
  }
);
