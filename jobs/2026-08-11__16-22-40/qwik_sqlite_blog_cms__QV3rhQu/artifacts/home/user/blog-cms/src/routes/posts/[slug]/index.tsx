import { component$ } from "@builder.io/qwik";
import { routeLoader$, type DocumentHead } from "@builder.io/qwik-city";
import { getPostBySlug } from "../../../db.server";

export const usePostLoader = routeLoader$(async ({ params, status }) => {
  const post = getPostBySlug(params.slug);
  if (!post || post.published !== 1) {
    status(404);
    return null;
  }
  return post;
});

export default component$(() => {
  const postSignal = usePostLoader();

  if (!postSignal.value) {
    return (
      <div class="error-banner">
        <h2>404: Post Not Found</h2>
        <p>The post you are looking for does not exist or has not been published.</p>
      </div>
    );
  }

  const post = postSignal.value;

  return (
    <article class="post-detail">
      <h1>{post.title}</h1>
      <div class="meta">
        Published on {new Date(post.created_at).toLocaleDateString()}
      </div>
      <div class="content">{post.content}</div>
    </article>
  );
});

export const head: DocumentHead = ({ resolveValue }) => {
  const post = resolveValue(usePostLoader);
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
