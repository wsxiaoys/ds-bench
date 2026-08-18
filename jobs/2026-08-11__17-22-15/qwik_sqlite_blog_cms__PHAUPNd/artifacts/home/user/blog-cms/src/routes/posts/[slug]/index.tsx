import { component$ } from "@builder.io/qwik";
import { routeLoader$, Link, type DocumentHead } from "@builder.io/qwik-city";
import { getPostBySlug } from "../../../db.server";

export const usePost = routeLoader$(({ params, status }) => {
  const post = getPostBySlug(params.slug);
  if (!post || post.published === 0) {
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
        <header>
          <div class="nav-container">
            <h1>
              <Link href="/">Local SQLite Blog</Link>
            </h1>
            <div class="nav-links">
              <Link href="/">Home</Link>
              <Link href="/admin/">Admin</Link>
            </div>
          </div>
        </header>
        <main>
          <h2>Post Not Found</h2>
          <p>The post you are looking for does not exist or has not been published.</p>
          <Link href="/" class="back-link">
            &larr; Back to Home
          </Link>
        </main>
      </div>
    );
  }

  const post = postSignal.value;

  return (
    <div class="container">
      <header>
        <div class="nav-container">
          <h1>
            <Link href="/">Local SQLite Blog</Link>
          </h1>
          <div class="nav-links">
            <Link href="/">Home</Link>
            <Link href="/admin/">Admin</Link>
          </div>
        </div>
      </header>

      <main>
        <Link href="/" class="back-link">
          &larr; Back to Home
        </Link>
        <article>
          <h1>{post.title}</h1>
          <div class="post-meta">
            Published on {new Date(post.created_at).toLocaleDateString()}
          </div>
          <div class="post-content">{post.content}</div>
        </article>
      </main>
    </div>
  );
});

export const head: DocumentHead = ({ resolveValue }) => {
  const post = resolveValue(usePost);
  if (!post) {
    return {
      title: "Post Not Found",
    };
  }
  return {
    title: post.title,
    meta: [
      {
        name: "description",
        content: post.content.substring(0, 150),
      },
    ],
  };
};
