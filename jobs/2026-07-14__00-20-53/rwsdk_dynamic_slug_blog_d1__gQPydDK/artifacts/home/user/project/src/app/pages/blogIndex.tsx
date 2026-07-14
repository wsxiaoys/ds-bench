import type { Post } from "@/db/schema";

/**
 * Blog index page that lists every post.
 *
 * For each post we render an anchor whose visible text contains the post's
 * `title` and whose `href` is the slug-based dynamic route `/blog/<slug>`.
 */
export const BlogIndex = ({ posts }: { posts: Post[] }) => {
  return (
    <main>
      <h1>Blog</h1>
      {posts.length === 0 ? (
        <p>No posts yet.</p>
      ) : (
        <ul>
          {posts.map((post) => (
            <li key={post.id}>
              <a href={`/blog/${post.slug}`}>{post.title}</a>
            </li>
          ))}
        </ul>
      )}
      <p>
        <a href="/">← Home</a>
      </p>
    </main>
  );
};