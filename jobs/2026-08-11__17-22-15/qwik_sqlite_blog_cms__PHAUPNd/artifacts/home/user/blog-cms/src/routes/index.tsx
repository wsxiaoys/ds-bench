import { component$ } from "@builder.io/qwik";
import { routeLoader$, Link, type DocumentHead } from "@builder.io/qwik-city";
import { getPublishedPosts } from "../db.server";

export const usePublishedPosts = routeLoader$(() => {
  return getPublishedPosts();
});

export default component$(() => {
  const posts = usePublishedPosts();

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
        <h2>Latest Posts</h2>
        {posts.value.length === 0 ? (
          <p>No posts published yet.</p>
        ) : (
          <ul class="post-list">
            {posts.value.map((post) => (
              <li key={post.id} class="post-item">
                <h2>
                  <Link href={`/posts/${post.slug}/`}>{post.title}</Link>
                </h2>
                <div class="post-meta">
                  Published on {new Date(post.created_at).toLocaleDateString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Local SQLite Blog",
  meta: [
    {
      name: "description",
      content: "A Qwik City blog CMS backed by a local SQLite database",
    },
  ],
};
