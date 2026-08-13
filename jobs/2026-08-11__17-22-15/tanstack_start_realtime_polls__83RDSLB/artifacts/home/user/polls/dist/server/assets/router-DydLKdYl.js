import { createRootRoute, Outlet, HeadContent, Scripts, createFileRoute, lazyRouteComponent, createRouter } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
import { T as TSS_SERVER_FUNCTION, g as getServerFnById, c as createServerFn } from "../server.js";
import { c as createPoll, g as getPoll, a as castVote } from "./db-BA0ZmELm.js";
import { json } from "@tanstack/router-core/ssr/client";
import crypto from "crypto";
const Route$5 = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8"
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1"
      },
      {
        title: "Real-Time Polling App"
      }
    ]
  }),
  component: RootComponent
});
function RootComponent() {
  return /* @__PURE__ */ jsx(RootDocument, { children: /* @__PURE__ */ jsx(Outlet, {}) });
}
function RootDocument({ children }) {
  return /* @__PURE__ */ jsxs("html", { lang: "en", children: [
    /* @__PURE__ */ jsx("head", { children: /* @__PURE__ */ jsx(HeadContent, {}) }),
    /* @__PURE__ */ jsxs("body", { children: [
      /* @__PURE__ */ jsx("div", { style: { fontFamily: "sans-serif", maxWidth: "800px", margin: "0 auto", padding: "20px" }, children }),
      /* @__PURE__ */ jsx(Scripts, {})
    ] })
  ] });
}
var createSsrRpc = (functionId) => {
  const url = "/_serverFn/" + functionId;
  const serverFnMeta = { id: functionId };
  const fn = async (...args) => {
    return (await getServerFnById(functionId))(...args);
  };
  return Object.assign(fn, {
    url,
    serverFnMeta,
    [TSS_SERVER_FUNCTION]: true
  });
};
const getPollsFn = createServerFn({
  method: "GET"
}).handler(createSsrRpc("c5075b2022b45ba158086587f128c119a4f570c4ff821c72e174f3a1e10ab271"));
const getPollFn = createServerFn({
  method: "GET"
}).validator((id) => id).handler(createSsrRpc("e3817fad326f8e36c80d06f7edeeba1b1e14c9f87a97d72688cf2c5042fdb7bf"));
const createPollFn = createServerFn({
  method: "POST"
}).validator((data) => data).handler(createSsrRpc("8b0b74f3fc455eef7eacad32a7323bfc88352970795b6ff79061ffea637c62d9"));
const $$splitComponentImporter$1 = () => import("./index-Dt-FpQQ_.js");
const Route$4 = createFileRoute("/")({
  loader: async () => {
    return await getPollsFn();
  },
  component: lazyRouteComponent($$splitComponentImporter$1, "component")
});
const Route$3 = createFileRoute("/api/polls")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { question, options } = body;
          if (!question || typeof question !== "string" || question.trim() === "") {
            return json({ error: "Question is required" }, { status: 400 });
          }
          if (!options || !Array.isArray(options)) {
            return json({ error: "Options must be an array" }, { status: 400 });
          }
          const validOptions = options.map((o) => typeof o === "string" ? o.trim() : "").filter((o) => o !== "");
          if (validOptions.length < 2) {
            return json({ error: "At least 2 non-empty options are required" }, { status: 400 });
          }
          const poll = await createPoll(question.trim(), validOptions);
          return json(poll, { status: 201 });
        } catch (err) {
          return json({ error: err.message || "Invalid request" }, { status: 400 });
        }
      }
    }
  }
});
const $$splitErrorComponentImporter = () => import("./poll._id-C__cpdF1.js");
const $$splitComponentImporter = () => import("./poll._id-D3LujTnH.js");
const Route$2 = createFileRoute("/poll/$id")({
  loader: async ({
    params
  }) => {
    const data = await getPollFn({
      data: params.id
    });
    if (!data) {
      throw new Error("Poll not found");
    }
    return data;
  },
  component: lazyRouteComponent($$splitComponentImporter, "component"),
  errorComponent: lazyRouteComponent($$splitErrorComponentImporter, "errorComponent")
});
const Route$1 = createFileRoute("/api/polls/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const { id } = params;
          if (!id) {
            return json({ error: "Poll ID is required" }, { status: 400 });
          }
          const poll = await getPoll(id);
          if (!poll) {
            return json({ error: "Poll not found" }, { status: 404 });
          }
          return json(poll, { status: 200 });
        } catch (err) {
          return json({ error: err.message || "Internal server error" }, { status: 500 });
        }
      }
    }
  }
});
const Route = createFileRoute("/api/polls/$id/vote")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        try {
          const { id } = params;
          if (!id) {
            return json({ error: "Poll ID is required" }, { status: 400 });
          }
          let body;
          try {
            body = await request.json();
          } catch (e) {
            return json({ error: "Invalid JSON body" }, { status: 400 });
          }
          const { optionId } = body;
          if (!optionId || typeof optionId !== "string") {
            return json({ error: "Option ID is required" }, { status: 400 });
          }
          const cookieHeader = request.headers.get("cookie") || "";
          const match = cookieHeader.match(/(?:^|; )client_id=([^;]*)/);
          let clientId = match ? match[1] : null;
          if (!clientId) {
            clientId = crypto.randomUUID();
          }
          const poll = await castVote(id, optionId, clientId);
          const headers = new Headers();
          headers.set("Set-Cookie", `client_id=${clientId}; Path=/; HttpOnly; Max-Age=31536000; SameSite=Lax`);
          return json(poll, { status: 200, headers });
        } catch (err) {
          if (err.message === "POLL_NOT_FOUND" || err.message === "OPTION_NOT_FOUND") {
            return json({ error: "Poll or option not found" }, { status: 404 });
          }
          if (err.message === "ALREADY_VOTED") {
            return json({ error: "You have already voted on this poll" }, { status: 409 });
          }
          return json({ error: err.message || "Internal server error" }, { status: 500 });
        }
      }
    }
  }
});
const IndexRoute = Route$4.update({
  id: "/",
  path: "/",
  getParentRoute: () => Route$5
});
const ApiPollsRoute = Route$3.update({
  id: "/api/polls",
  path: "/api/polls",
  getParentRoute: () => Route$5
});
const PollIdRoute = Route$2.update({
  id: "/poll/$id",
  path: "/poll/$id",
  getParentRoute: () => Route$5
});
const ApiPollsIdRoute = Route$1.update({
  id: "/$id",
  path: "/$id",
  getParentRoute: () => ApiPollsRoute
});
const ApiPollsIdVoteRoute = Route.update({
  id: "/vote",
  path: "/vote",
  getParentRoute: () => ApiPollsIdRoute
});
const ApiPollsIdRouteChildren = {
  ApiPollsIdVoteRoute
};
const ApiPollsIdRouteWithChildren = ApiPollsIdRoute._addFileChildren(
  ApiPollsIdRouteChildren
);
const ApiPollsRouteChildren = {
  ApiPollsIdRoute: ApiPollsIdRouteWithChildren
};
const ApiPollsRouteWithChildren = ApiPollsRoute._addFileChildren(
  ApiPollsRouteChildren
);
const rootRouteChildren = {
  IndexRoute,
  ApiPollsRoute: ApiPollsRouteWithChildren,
  PollIdRoute
};
const routeTree = Route$5._addFileChildren(rootRouteChildren)._addFileTypes();
function getRouter() {
  const router2 = createRouter({
    routeTree,
    scrollRestoration: true
  });
  return router2;
}
const router = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  getRouter
}, Symbol.toStringTag, { value: "Module" }));
export {
  Route$4 as R,
  Route$2 as a,
  createPollFn as c,
  getPollFn as g,
  router as r
};
