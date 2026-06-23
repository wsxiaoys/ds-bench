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
  route("/status", () => new Response(JSON.stringify({ ok: true, name: "rwsdk" }), { headers: { "content-type": "application/json" } })),
  render(Document, [
    route("/", Home),
    route("/ping", () => <h1>Pong!</h1>),
    route("/about", () => (
      <>
        <h1>About RedwoodSDK</h1>
        <p>React framework for Cloudflare</p>
      </>
    )),
    route("/greet/:name", ({ params }) => <h1>{`Hello, ${params.name}!`}</h1>),
  ]),
]);
