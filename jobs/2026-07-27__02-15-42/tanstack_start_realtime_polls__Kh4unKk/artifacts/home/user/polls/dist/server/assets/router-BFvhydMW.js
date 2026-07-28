import { t as Route$4 } from "./routes-_K5Z6BYs.js";
import { i as listPolls, n as createPoll, r as getPoll, t as castVote } from "./db-BEhEHZrU.js";
import { t as Route$5 } from "./poll._id-DQ1Rt90H.js";
import "react";
import { HeadContent, Outlet, Scripts, ScrollRestoration, createFileRoute, createRootRoute, createRouter } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
import { v4 } from "uuid";
//#region src/routes/__root.tsx
var Route$3 = createRootRoute({
	meta: () => [
		{ charSet: "utf-8" },
		{
			name: "viewport",
			content: "width=device-width, initial-scale=1"
		},
		{ title: "Real-Time Polling App" }
	],
	component: RootComponent
});
function RootComponent() {
	return /* @__PURE__ */ jsx(RootDocument, { children: /* @__PURE__ */ jsx(Outlet, {}) });
}
function RootDocument({ children }) {
	return /* @__PURE__ */ jsxs("html", {
		lang: "en",
		children: [/* @__PURE__ */ jsxs("head", { children: [/* @__PURE__ */ jsx(HeadContent, {}), /* @__PURE__ */ jsx("style", { children: `
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f9fafb;
            color: #111827;
          }
          header {
            background-color: #ffffff;
            border-bottom: 1px solid #e5e7eb;
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          header h1 {
            margin: 0;
            font-size: 1.5rem;
          }
          header h1 a {
            color: #111827;
            text-decoration: none;
          }
          main {
            max-width: 800px;
            margin: 2rem auto;
            padding: 0 1rem;
          }
          .card {
            background-color: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 0.5rem;
            padding: 1.5rem;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            margin-bottom: 1.5rem;
          }
          .btn {
            background-color: #2563eb;
            color: #ffffff;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 0.375rem;
            cursor: pointer;
            font-weight: 500;
          }
          .btn:hover {
            background-color: #1d4ed8;
          }
          .btn-secondary {
            background-color: #f3f4f6;
            color: #374151;
            border: 1px solid #d1d5db;
          }
          .btn-secondary:hover {
            background-color: #e5e7eb;
          }
          .error {
            color: #dc2626;
            background-color: #fef2f2;
            border: 1px solid #fecaca;
            padding: 0.75rem;
            border-radius: 0.375rem;
            margin-bottom: 1rem;
          }
        ` })] }), /* @__PURE__ */ jsxs("body", { children: [
			/* @__PURE__ */ jsx("header", { children: /* @__PURE__ */ jsx("h1", { children: /* @__PURE__ */ jsx("a", {
				href: "/",
				children: "⚡ Real-Time Polls"
			}) }) }),
			/* @__PURE__ */ jsx("main", { children }),
			/* @__PURE__ */ jsx(ScrollRestoration, {}),
			/* @__PURE__ */ jsx(Scripts, {})
		] })]
	});
}
//#endregion
//#region src/routes/api/polls.ts
var Route$2 = createFileRoute("/api/polls")({ server: { handlers: {
	GET: async ({ request }) => {
		try {
			const polls = await listPolls();
			return Response.json(polls);
		} catch (err) {
			return Response.json({ error: err.message }, { status: 500 });
		}
	},
	POST: async ({ request }) => {
		try {
			const { question, options } = await request.json();
			if (!question || typeof question !== "string" || question.trim() === "") return Response.json({ error: "Question is required" }, { status: 400 });
			const validOptions = (options || []).filter((opt) => typeof opt === "string" && opt.trim() !== "");
			if (validOptions.length < 2) return Response.json({ error: "At least 2 non-empty options are required" }, { status: 400 });
			const poll = await createPoll(question.trim(), validOptions.map((o) => o.trim()));
			return Response.json(poll, { status: 201 });
		} catch (err) {
			return Response.json({ error: err.message }, { status: 500 });
		}
	}
} } });
//#endregion
//#region src/routes/api/polls.$id.ts
var Route$1 = createFileRoute("/api/polls/$id")({ server: { handlers: { GET: async ({ request, params }) => {
	const { id } = params;
	try {
		const poll = await getPoll(id);
		if (!poll) return Response.json({ error: "Poll not found" }, { status: 404 });
		return Response.json(poll);
	} catch (err) {
		return Response.json({ error: err.message }, { status: 500 });
	}
} } } });
//#endregion
//#region src/routes/api/polls.$id.vote.ts
function getCookie(request, name) {
	const cookies = (request.headers.get("Cookie") || "").split(";").map((c) => c.trim());
	for (const cookie of cookies) {
		const [k, v] = cookie.split("=");
		if (k === name) return decodeURIComponent(v || "");
	}
	return null;
}
var Route = createFileRoute("/api/polls/$id/vote")({ server: { handlers: { POST: async ({ request, params }) => {
	const { id: pollId } = params;
	try {
		const { optionId } = await request.json();
		if (!optionId) return Response.json({ error: "optionId is required" }, { status: 400 });
		let clientId = getCookie(request, "client_id");
		let setCookieHeader = null;
		if (!clientId) {
			clientId = v4();
			setCookieHeader = `client_id=${clientId}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax`;
		}
		try {
			const updatedPoll = await castVote(pollId, optionId, clientId);
			const headers = { "Content-Type": "application/json" };
			if (setCookieHeader) headers["Set-Cookie"] = setCookieHeader;
			else headers["Set-Cookie"] = `client_id=${clientId}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax`;
			return new Response(JSON.stringify(updatedPoll), {
				status: 200,
				headers
			});
		} catch (err) {
			if (err.message === "POLL_NOT_FOUND" || err.message === "OPTION_NOT_FOUND") return Response.json({ error: "Poll or option not found" }, { status: 404 });
			if (err.message === "ALREADY_VOTED") return Response.json({ error: "You have already voted on this poll" }, { status: 409 });
			throw err;
		}
	} catch (err) {
		return Response.json({ error: err.message }, { status: 500 });
	}
} } } });
//#endregion
//#region src/routeTree.gen.ts
var IndexRoute = Route$4.update({
	id: "/",
	path: "/",
	getParentRoute: () => Route$3
});
var ApiPollsRoute = Route$2.update({
	id: "/api/polls",
	path: "/api/polls",
	getParentRoute: () => Route$3
});
var PollIdRoute = Route$5.update({
	id: "/poll/$id",
	path: "/poll/$id",
	getParentRoute: () => Route$3
});
var ApiPollsIdRoute = Route$1.update({
	id: "/$id",
	path: "/$id",
	getParentRoute: () => ApiPollsRoute
});
var ApiPollsIdRouteChildren = { ApiPollsIdVoteRoute: Route.update({
	id: "/vote",
	path: "/vote",
	getParentRoute: () => ApiPollsIdRoute
}) };
var ApiPollsRouteChildren = { ApiPollsIdRoute: ApiPollsIdRoute._addFileChildren(ApiPollsIdRouteChildren) };
var rootRouteChildren = {
	IndexRoute,
	ApiPollsRoute: ApiPollsRoute._addFileChildren(ApiPollsRouteChildren),
	PollIdRoute
};
var routeTree = Route$3._addFileChildren(rootRouteChildren)._addFileTypes();
//#endregion
//#region src/router.tsx
function getRouter() {
	return createRouter({
		routeTree,
		defaultPreload: "intent"
	});
}
//#endregion
export { getRouter };
