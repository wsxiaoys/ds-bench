import { route } from "rwsdk/router";

export const sessionsRoutes = [
  route("/api/sessions/test", () => {
    return new Response(JSON.stringify({ envType: typeof env, hasSessions: typeof env !== "undefined" && !!env.SESSIONS }), {
      headers: { "Content-Type": "application/json" }
    });
  }),
];
