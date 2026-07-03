import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  // /status returns a raw JSON Response (does not need the Document wrapper)
  route("/status", () => {
    return new Response(JSON.stringify({ ok: true, name: "rwsdk" }), {
      headers: { "content-type": "application/json" },
    });
  }),
  render(Document, [
    route("/", Home),
    route("/ping", () => {
      return <h1>Pong!</h1>;
    }),
    route("/about", () => {
      return (
        <>
          <h1>About RedwoodSDK</h1>
          <p>React framework for Cloudflare.</p>
        </>
      );
    }),
    route("/greet/:name", ({ params }) => {
      return <h1>Hello, {params.name}!</h1>;
    }),
  ]),
]);
