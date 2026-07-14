import type { Post } from "@/db/schema";

export const BlogIndex = ({ posts }: { posts: Post[] }) => {
  return (
    <div>
      <h1>Blog</h1>
      <ul>
        {posts.map((post) => (
          <li key={post.id}>
            <a href={`/blog/${post.slug}`}>{post.title}</a>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const BlogPostPage = ({ post }: { post: Post }) => {
  return (
    <article>
      <h1>{post.title}</h1>
      <div>{post.content}</div>
    </article>
  );
};

export const NotFound = () => {
  return (
    <div>
      <h1>404</h1>
      <p>Post not found.</p>
    </div>
  );
};