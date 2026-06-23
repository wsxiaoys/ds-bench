import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

export type AppContext = {};

const Ping = () => <h1>Pong!</h1>;

const About = () => (
  <>
    <h1>About RedwoodSDK</h1>
    <p>React framework for Cloudflare</p>
  </>
);

const Greet = ({ params }: { params: { name: string } }) => {
  return <h1>Hello, {params.name}!</h1>;
};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  route("/status", () => {
    return new Response(JSON.stringify({ ok: true, name: "rwsdk" }), {
      headers: { "content-type": "application/json" },
    });
  }),
  render(Document, [
    route("/", Home),
    route("/ping", Ping),
    route("/about", About),
    route("/greet/:name", Greet),
  ]),
]);
