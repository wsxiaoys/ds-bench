import { component$ } from "@builder.io/qwik";
import { routeLoader$, Link, type DocumentHead } from "@builder.io/qwik-city";
import { getPublishedPosts, type Post } from "../db.server";

export const usePublishedPosts = routeLoader$(async () => {
  return getPublishedPosts();
});

export default component$(() => {
  const postsSignal = usePublishedPosts();

  return (
    <div>
      <h2>Published Posts</h2>
      {postsSignal.value.length === 0 ? (
        <p>No posts published yet.</p>
      ) : (
        <ul class="post-list">
          {postsSignal.value.map((post: Post) => (
            <li key={post.id} class="post-item">
              <div>
                <h3>
                  <Link href={`/posts/${post.slug}/`}>{post.title}</Link>
                </h3>
                <div class="post-meta">
                  Published on {new Date(post.created_at).toLocaleDateString()}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

export const head: DocumentHead = {
  title: "My SQLite Blog",
  meta: [
    {
      name: "description",
      content: "A Qwik City blog CMS backed by local SQLite",
    },
  ],
};
