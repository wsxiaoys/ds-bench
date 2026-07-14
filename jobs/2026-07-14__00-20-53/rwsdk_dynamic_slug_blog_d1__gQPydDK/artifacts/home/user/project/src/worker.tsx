import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { BlogIndex } from "@/app/pages/blogIndex";
import { BlogPost } from "@/app/pages/blogPost";
import { Home } from "@/app/pages/home";
import { createDb } from "@/db/client";
import { posts } from "@/db/schema";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [
    route("/", Home),

    // Blog index — lists every post persisted in D1.
    route("/blog", async () => {
      const db = createDb(env);
      const rows = await db.select().from(posts).all();
      return <BlogIndex posts={rows} />;
    }),

    // Dynamic slug route — looks up a single post by slug and renders it.
    // Returns 404 when no post matches.
    route("/blog/:slug", async ({ params }) => {
      const db = createDb(env);
      const row = await db
        .select()
        .from(posts)
        .where(eq(posts.slug, params.slug))
        .get();

      if (!row) {
        return new Response("Post not found", {
          status: 404,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      return <BlogPost post={row} />;
    }),
  ]),
]);