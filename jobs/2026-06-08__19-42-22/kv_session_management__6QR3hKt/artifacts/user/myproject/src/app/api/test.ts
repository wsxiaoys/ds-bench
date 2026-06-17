import { route } from "rwsdk/router";

export const testRoutes = [
  route("/api/sessions/test", () => {
    return new Response(JSON.stringify({ 
      sessionsType: typeof process !== "undefined" ? typeof process.env.SESSIONS : "no process"
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }),
];
