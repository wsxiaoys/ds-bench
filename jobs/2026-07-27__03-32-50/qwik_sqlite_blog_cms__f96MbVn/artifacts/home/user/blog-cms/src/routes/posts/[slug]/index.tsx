import { component$ } from "@builder.io/qwik";
import { routeLoader$ } from "@builder.io/qwik-city";
import type { DocumentHead } from "@builder.io/qwik-city";
import { getPostBySlug } from "~/lib/db.server";

export const usePost = routeLoader$(async ({ params, status }) => {
  const post = getPostBySlug(params.slug);
  if (!post) {
    status(404);
    return null;
  }
  return post;
});

export default component$(() => {
  const post = usePost();

  if (!post.value) {
    return (
      <>
        <h1>404 - Post Not Found</h1>
        <p>The post you are looking for does not exist.</p>
      </>
    );
  }

  return (
    <article>
      <h1>{post.value.title}</h1>
      <div>{post.value.content}</div>
    </article>
  );
});

export const head: DocumentHead = ({ resolveValue }) => {
  const post = resolveValue(usePost);
  return {
    title: post ? post.title : "Post Not Found",
  };
};
