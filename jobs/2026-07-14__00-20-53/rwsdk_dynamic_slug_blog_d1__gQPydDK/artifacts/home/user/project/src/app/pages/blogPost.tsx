import type { Post } from "@/db/schema";

/**
 * Single blog post page.
 *
 * Renders the post's `title` and `content`. Both values must be present in
 * the returned HTML for the dynamic slug route to satisfy the spec.
 */
export const BlogPost = ({ post }: { post: Post }) => {
  return (
    <main>
      <article>
        <h1>{post.title}</h1>
        <div>
          {post.content.split(/\n{2,}/).map((paragraph, idx) => (
            <p key={idx}>{paragraph}</p>
          ))}
        </div>
      </article>
      <p>
        <a href="/blog">← Back to all posts</a>
      </p>
    </main>
  );
};