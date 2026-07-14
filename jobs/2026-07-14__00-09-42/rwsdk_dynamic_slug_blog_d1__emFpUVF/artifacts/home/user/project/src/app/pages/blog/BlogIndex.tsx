import { drizzle } from "drizzle-orm/d1";
import { env } from "cloudflare:workers";
import { posts } from "@/db/schema";

export const BlogIndex = async () => {
  const db = drizzle(env.DB);
  const allPosts = await db.select().from(posts).all();

  return (
    <main>
      <h1>Blog</h1>
      {allPosts.length === 0 ? (
        <p>No posts yet.</p>
      ) : (
        <ul>
          {allPosts.map((post) => (
            <li key={post.id}>
              <a href={`/blog/${post.slug}`}>{post.title}</a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
};
