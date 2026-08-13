import { createRootRoute, Outlet, HeadContent, ScrollRestoration, Scripts, createFileRoute, lazyRouteComponent, createRouter as createRouter$1 } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
import { T as TSS_SERVER_FUNCTION, g as getServerFnById, c as createServerFn } from "../server.js";
import { createPoll, getPoll, castVote } from "./db-BgzlcB5H.js";
import crypto from "node:crypto";
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
      /* @__PURE__ */ jsx("div", { style: { fontFamily: "system-ui, sans-serif", margin: "0 auto", maxWidth: "800px", padding: "2rem 1rem" }, children }),
      /* @__PURE__ */ jsx(ScrollRestoration, {}),
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
}).handler(createSsrRpc("71e164b088516cdf38321a9c5af96f0d575a80ef2e6dc523902f9d007befd466"));
const getPollFn = createServerFn({
  method: "GET"
}).validator((id) => id).handler(createSsrRpc("1e9c19c61edb103ded5c18abfd90f2f897fd1937feeefac267aca7b5a7146301"));
const $$splitComponentImporter$1 = () => import("./index-D5V0Vfzy.js");
const Route$4 = createFileRoute("/")({
  loader: async () => {
    const polls = await getPollsFn();
    return {
      polls
    };
  },
  component: lazyRouteComponent($$splitComponentImporter$1, "component")
});
const Route$3 = createFileRoute("/api/polls")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const question = body?.question;
          const options = body?.options;
          if (!question || typeof question !== "string" || question.trim() === "") {
            return Response.json({ error: "Question cannot be empty" }, { status: 400 });
          }
          if (!options || !Array.isArray(options)) {
            return Response.json({ error: "Options must be an array" }, { status: 400 });
          }
          const nonOpt = options.map((o) => o ? String(o).trim() : "").filter((o) => o !== "");
          if (nonOpt.length < 2) {
            return Response.json({ error: "At least 2 non-empty options are required" }, { status: 400 });
          }
          const poll = createPoll(question.trim(), nonOpt);
          return Response.json(poll, { status: 201 });
        } catch (err) {
          return Response.json({ error: err.message || "Invalid request" }, { status: 400 });
        }
      }
    }
  }
});
const $$splitComponentImporter = () => import("./poll._id-BOF2M9GQ.js");
const Route$2 = createFileRoute("/poll/$id")({
  loader: async ({
    params
  }) => {
    const poll = await getPollFn(params.id);
    return {
      initialPoll: poll,
      pollId: params.id
    };
  },
  component: lazyRouteComponent($$splitComponentImporter, "component")
});
const Route$1 = createFileRoute("/api/polls/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { id } = params;
        const poll = getPoll(id);
        if (!poll) {
          return Response.json({ error: "Poll not found" }, { status: 404 });
        }
        return Response.json(poll);
      }
    }
  }
});
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [key, ...valueParts] = part.split("=");
    if (key) {
      cookies[key.trim()] = valueParts.join("=").trim();
    }
  }
  return cookies;
}
function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${value}`];
  if (options.path) {
    parts.push(`Path=${options.path}`);
  } else {
    parts.push("Path=/");
  }
  if (options.maxAge !== void 0) {
    parts.push(`Max-Age=${options.maxAge}`);
  } else {
    parts.push("Max-Age=31536000");
  }
  parts.push("HttpOnly");
  return parts.join("; ");
}
const Route = createFileRoute("/api/polls/$id/vote")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const { id: pollId } = params;
        try {
          const body = await request.json();
          const optionId = body?.optionId;
          if (!optionId) {
            return Response.json({ error: "Option ID is required" }, { status: 400 });
          }
          const cookieHeader = request.headers.get("Cookie");
          const cookies = parseCookies(cookieHeader);
          let clientId = cookies["client_id"];
          if (!clientId) {
            clientId = crypto.randomUUID();
          }
          const result = castVote(pollId, optionId, clientId);
          if (!result.success) {
            return Response.json({ error: result.error }, { status: result.status });
          }
          const headers = new Headers();
          headers.set("Content-Type", "application/json");
          headers.set("Set-Cookie", serializeCookie("client_id", clientId, { maxAge: 31536e3, path: "/" }));
          return new Response(JSON.stringify(result.poll), {
            status: 200,
            headers
          });
        } catch (err) {
          return Response.json({ error: err.message || "Invalid request" }, { status: 400 });
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
function createRouter() {
  return createRouter$1({
    routeTree,
    scrollRestoration: true
  });
}
function getRouter() {
  return createRouter();
}
const router = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createRouter,
  getRouter
}, Symbol.toStringTag, { value: "Module" }));
export {
  Route$4 as R,
  Route$2 as a,
  router as r
};
