import { component$ } from "@builder.io/qwik";
import { routeLoader$, Link } from "@builder.io/qwik-city";
import { getDb } from "../../../lib/db.server";
import type { Post } from "../../../lib/db.server";

export const usePost = routeLoader$(({ params, status }) => {
  const db = getDb();
  const post = db
    .prepare("SELECT * FROM posts WHERE slug = ? AND published = 1")
    .get(params.slug) as Post | undefined;

  if (!post) {
    status(404);
    return null;
  }

  return post;
});

export default component$(() => {
  const postSignal = usePost();

  if (!postSignal.value) {
    return (
      <div class="container">
        <div class="alert-danger">
          <h2>404 - Post Not Found</h2>
          <p>The post you are looking for does not exist or has not been published.</p>
        </div>
        <Link href="/" class="btn btn-primary">
          Back to Home
        </Link>
      </div>
    );
  }

  const post = postSignal.value;

  return (
    <div class="container post-detail">
      <header class="header">
        <h1>{post.title}</h1>
        <nav>
          <Link href="/" class="nav-link">
            Home
          </Link>
        </nav>
      </header>

      <div class="meta">
        Published on {new Date(post.created_at).toLocaleDateString()}
      </div>

      <article class="post-content">{post.content}</article>
    </div>
  );
});
