import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { posts } from "@/db/schema";

export const BlogPost = async ({ slug }: { slug: string }) => {
  const db = drizzle(env.DB);
  const results = await db
    .select()
    .from(posts)
    .where(eq(posts.slug, slug))
    .all();

  const post = results[0];

  if (!post) {
    return null;
  }

  return (
    <main>
      <h1>{post.title}</h1>
      <article>{post.content}</article>
      <p>
        <a href="/blog">← Back to blog</a>
      </p>
    </main>
  );
};
