import { component$ } from "@builder.io/qwik";
import { Link, routeLoader$ } from "@builder.io/qwik-city";
import type { DocumentHead } from "@builder.io/qwik-city";
import { listPublishedPosts } from "~/lib/db.server";

export const usePublishedPosts = routeLoader$(() => {
  return listPublishedPosts();
});

export default component$(() => {
  const posts = usePublishedPosts();

  return (
    <>
      <h1>Blog</h1>
      {posts.value.length === 0 ? (
        <p>No posts published yet.</p>
      ) : (
        <ul>
          {posts.value.map((post) => (
            <li key={post.id}>
              <Link href={`/posts/${post.slug}/`}>{post.title}</Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
});

export const head: DocumentHead = {
  title: "Blog",
  meta: [
    {
      name: "description",
      content: "A small blog CMS built with Qwik City.",
    },
  ],
};
