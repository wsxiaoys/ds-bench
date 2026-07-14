import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { eq } from "drizzle-orm";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { BlogIndex, BlogPostPage, NotFound } from "@/app/pages/blog";
import { getDb, setEnv } from "@/db";
import { posts } from "@/db/schema";

export type AppContext = {
  db: ReturnType<typeof getDb>;
};

const app = defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    ctx.db = getDb();
  },
  render(Document, [
    route("/", Home),
    route("/blog", async () => {
      const db = getDb();
      const allPosts = await db.select().from(posts).all();
      return <BlogIndex posts={allPosts} />;
    }),
    route("/blog/:slug", async ({ params, response }) => {
      const db = getDb();
      const post = await db
        .select()
        .from(posts)
        .where(eq(posts.slug, params.slug))
        .get();

      if (!post) {
        response.status = 404;
        return <NotFound />;
      }

      return <BlogPostPage post={post} />;
    }),
  ]),
]);

export default {
  ...app,
  fetch: async (request: Request, env: Env, cf: ExecutionContext) => {
    setEnv(env);
    return app.fetch(request, env, cf);
  },
};