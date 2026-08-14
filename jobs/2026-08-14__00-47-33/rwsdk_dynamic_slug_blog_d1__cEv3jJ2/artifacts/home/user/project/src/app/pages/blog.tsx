import React from "react";
import { db } from "@/db";
import { posts } from "@/db/schema";

export const BlogPage = async () => {
  const allPosts = await db.select().from(posts);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
      <h1>Blog Posts</h1>
      {allPosts.length === 0 ? (
        <p>No posts found.</p>
      ) : (
        <ul>
          {allPosts.map((post) => (
            <li key={post.id} style={{ margin: "1rem 0" }}>
              <a href={`/blog/${post.slug}`} style={{ fontSize: "1.2rem", textDecoration: "none", color: "#0070f3" }}>
                {post.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
