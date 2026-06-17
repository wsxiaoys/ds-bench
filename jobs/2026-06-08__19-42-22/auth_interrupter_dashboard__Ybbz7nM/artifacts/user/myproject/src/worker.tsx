import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { Login } from "@/app/pages/login";
import { Dashboard } from "@/app/pages/dashboard";
import { signCookie, verifyCookie, parseCookies } from "./session";

export type AppContext = {
  username?: string;
};

// The interrupter pattern
const isAuthenticated = async (reqInfo: any) => {
  const cookieHeader = reqInfo.request.headers.get("Cookie");
  const cookies = parseCookies(cookieHeader);
  if (!cookies.session) {
    return new Response(null, {
      status: 302,
      headers: { Location: "/login" },
    });
  }

  const username = await verifyCookie(cookies.session);
  if (!username) {
    return new Response(null, {
      status: 302,
      headers: { Location: "/login" },
    });
  }

  reqInfo.ctx.username = username;
};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
  },
  render(Document, [
    route("/", Home),
    route("/login", {
      get: () => <Login />,
      post: async (reqInfo) => {
        const formData = await reqInfo.request.formData();
        const username = formData.get("username") as string;
        const password = formData.get("password") as string;

        if (username === "demo" && password === "pass") {
          const sessionValue = await signCookie(username);
          return new Response(null, {
            status: 302,
            headers: {
              Location: "/dashboard",
              "Set-Cookie": `session=${sessionValue}; HttpOnly; Path=/`,
            },
          });
        }

        reqInfo.response.status = 401;
        return <Login error="Invalid credentials" />;
      },
    }),
    route("/dashboard", [
      isAuthenticated,
      ({ ctx }) => <Dashboard username={ctx.username!} />,
    ]),
    route("/logout", {
      post: () => {
        return new Response(null, {
          status: 302,
          headers: {
            Location: "/login",
            "Set-Cookie": "session=; HttpOnly; Path=/; Max-Age=0",
          },
        });
      },
    }),
  ]),
]);
