import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { BlogIndex } from "@/app/pages/blog/BlogIndex";
import { BlogPost } from "@/app/pages/blog/BlogPost";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [
    route("/", Home),
    route("/blog", () => <BlogIndex />),
    route("/blog/:slug", async ({ params }) => {
      const content = await BlogPost({ slug: params.slug });
      if (!content) {
        return new Response("Post not found", { status: 404 });
      }
      return content;
    }),
  ]),
]);
