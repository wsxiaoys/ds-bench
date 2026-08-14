import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { eq } from "drizzle-orm";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { BlogPage } from "@/app/pages/blog";
import { PostPage } from "@/app/pages/post";
import { db } from "@/db";
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
    route("/blog", BlogPage),
    route("/blog/:slug", async ({ params, response }) => {
      const { slug } = params;
      const post = await db.select().from(posts).where(eq(posts.slug, slug)).get();
      if (!post) {
        response.status = 404;
        return (
          <div style={{ fontFamily: "sans-serif", padding: "2rem", textAlign: "center" }}>
            <h1>404 - Post Not Found</h1>
            <p>The post you are looking for does not exist.</p>
            <p><a href="/blog">Back to Blog</a></p>
          </div>
        );
      }
      return <PostPage title={post.title} content={post.content} />;
    }),
  ]),
]);
