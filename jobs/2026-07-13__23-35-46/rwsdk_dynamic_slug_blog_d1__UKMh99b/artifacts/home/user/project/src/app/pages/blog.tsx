import React from "react";
import { drizzle } from "drizzle-orm/d1";
import { env } from "cloudflare:workers";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import { RequestInfo } from "rwsdk/worker";

function getDb() {
  return drizzle(env.DB, { schema });
}

export async function BlogIndex() {
  const db = getDb();
  const allPosts = await db.select().from(schema.posts);

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: "600px", margin: "40px auto", padding: "0 20px" }}>
      <h1 style={{ borderBottom: "1px solid #eee", paddingBottom: "10px" }}>Blog Index</h1>
      <ul style={{ listStyleType: "none", padding: 0 }}>
        {allPosts.map((post) => (
          <li key={post.id} style={{ margin: "15px 0" }}>
            <a href={`/blog/${post.slug}`} style={{ fontSize: "1.2rem", textDecoration: "none", color: "#0070f3" }}>
              {post.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export async function BlogPost(requestInfo: RequestInfo<{ slug: string }>) {
  const { slug } = requestInfo.params;
  const db = getDb();
  
  const post = await db
    .select()
    .from(schema.posts)
    .where(eq(schema.posts.slug, slug))
    .get();

  if (!post) {
    requestInfo.response.status = 404;
    return (
      <div style={{ fontFamily: "sans-serif", maxWidth: "600px", margin: "40px auto", padding: "0 20px" }}>
        <h1>404 - Post Not Found</h1>
        <p>The post with slug "{slug}" does not exist.</p>
        <p>
          <a href="/blog" style={{ color: "#0070f3" }}>Back to Blog</a>
        </p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: "600px", margin: "40px auto", padding: "0 20px" }}>
      <h1 style={{ borderBottom: "1px solid #eee", paddingBottom: "10px" }}>{post.title}</h1>
      <div style={{ fontSize: "1.1rem", lineHeight: "1.6", color: "#333", whiteSpace: "pre-wrap" }}>
        {post.content}
      </div>
      <p style={{ marginTop: "40px", borderTop: "1px solid #eee", paddingTop: "20px" }}>
        <a href="/blog" style={{ color: "#0070f3", textDecoration: "none" }}>&larr; Back to Blog</a>
      </p>
    </div>
  );
}
