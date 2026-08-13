import { component$ } from "@builder.io/qwik";
import { routeLoader$, Link } from "@builder.io/qwik-city";
import { getDb } from "../lib/db.server";
import type { Post } from "../lib/db.server";

export const usePublishedPosts = routeLoader$(() => {
  const db = getDb();
  const posts = db
    .prepare("SELECT * FROM posts WHERE published = 1 ORDER BY created_at DESC")
    .all() as Post[];
  return posts;
});

export default component$(() => {
  const posts = usePublishedPosts();

  return (
    <div class="container">
      <header class="header">
        <h1>My SQLite Blog</h1>
        <nav>
          <Link href="/admin/" class="nav-link">
            Admin Dashboard
          </Link>
        </nav>
      </header>

      <main>
        <h2>Published Posts</h2>
        {posts.value.length === 0 ? (
          <p>No posts published yet.</p>
        ) : (
          <ul class="posts-list">
            {posts.value.map((post) => (
              <li key={post.id} class="post-item">
                <div>
                  <Link href={`/posts/${post.slug}/`} class="post-link">
                    {post.title}
                  </Link>
                  <div class="post-date">
                    Published: {new Date(post.created_at).toLocaleDateString()}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
});

export const head = {
  title: "My SQLite Blog",
  meta: [
    {
      name: "description",
      content: "A minimal Qwik City blog CMS powered by SQLite",
    },
  ],
};
