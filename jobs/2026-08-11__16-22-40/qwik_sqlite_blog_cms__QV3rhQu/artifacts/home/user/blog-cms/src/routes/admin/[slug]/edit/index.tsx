import { component$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, zod$, Form, Link, type DocumentHead } from "@builder.io/qwik-city";
import { z } from "zod";
import { getPostBySlug, updatePostBySlug } from "../../../../db.server";

export const usePostLoader = routeLoader$(async ({ params, status }) => {
  const post = getPostBySlug(params.slug);
  if (!post) {
    status(404);
    return null;
  }
  return post;
});

export const useEditPost = routeAction$(
  async (data, { params, fail, redirect }) => {
    const oldSlug = params.slug;
    const newSlug = data.slug;

    // If slug is changed, check uniqueness of the new slug
    if (newSlug !== oldSlug) {
      const existing = getPostBySlug(newSlug);
      if (existing) {
        return fail(400, {
          fieldErrors: {
            slug: ["Slug must be unique. A post with this slug already exists."],
          },
        });
      }
    }

    try {
      updatePostBySlug(oldSlug, {
        slug: newSlug,
        title: data.title,
        content: data.content,
        published: data.published ? 1 : 0,
      });
    } catch (err: any) {
      return fail(500, {
        message: "Failed to update post: " + err.message,
      });
    }

    throw redirect(303, "/admin/");
  },
  zod$({
    title: z.string().min(3, "Title must be at least 3 characters"),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be in kebab-case (e.g. 'my-post-title')"),
    content: z.string().min(1, "Content must not be empty"),
    published: z.preprocess((val) => val === "on" || val === "true" || val === true, z.boolean()).default(false),
  })
);

export default component$(() => {
  const postSignal = usePostLoader();
  const action = useEditPost();
  const fieldErrors = action.value?.fieldErrors as Record<string, string[] | undefined> | undefined;

  if (!postSignal.value) {
    return (
      <div class="error-banner">
        <h2>404: Post Not Found</h2>
        <p>The post you are trying to edit does not exist.</p>
        <Link href="/admin/" class="btn">Back to Admin</Link>
      </div>
    );
  }

  const post = postSignal.value;

  const titleVal = action.formData
    ? (action.formData.get("title") as string) ?? ""
    : post.title;

  const slugVal = action.formData
    ? (action.formData.get("slug") as string) ?? ""
    : post.slug;

  const contentVal = action.formData
    ? (action.formData.get("content") as string) ?? ""
    : post.content;

  const publishedVal = action.formData
    ? action.formData.get("published") === "on"
    : post.published === 1;

  return (
    <div>
      <h2>Edit Post</h2>

      {action.value?.message && (
        <div class="error-banner">
          {action.value.message}
        </div>
      )}

      <Form action={action} class="post-form">
        <div class="form-group">
          <label for="title">Title</label>
          <input
            type="text"
            id="title"
            name="title"
            value={titleVal}
            placeholder="Enter post title"
          />
          {fieldErrors?.title && (
            <p class="error">{Array.isArray(fieldErrors.title) ? fieldErrors.title.join(", ") : fieldErrors.title}</p>
          )}
        </div>

        <div class="form-group">
          <label for="slug">Slug</label>
          <input
            type="text"
            id="slug"
            name="slug"
            value={slugVal}
            placeholder="my-post-title"
          />
          {fieldErrors?.slug && (
            <p class="error">{Array.isArray(fieldErrors.slug) ? fieldErrors.slug.join(", ") : fieldErrors.slug}</p>
          )}
        </div>

        <div class="form-group">
          <label for="content">Content</label>
          <textarea
            id="content"
            name="content"
            value={contentVal}
            placeholder="Write your post content here..."
          />
          {fieldErrors?.content && (
            <p class="error">{Array.isArray(fieldErrors.content) ? fieldErrors.content.join(", ") : fieldErrors.content}</p>
          )}
        </div>

        <div class="form-group checkbox-group">
          <input
            type="checkbox"
            id="published"
            name="published"
            checked={publishedVal}
          />
          <label for="published">Published</label>
        </div>

        <div class="actions-row">
          <button type="submit" class="btn">
            {action.isRunning ? "Saving..." : "Save Changes"}
          </button>
          <Link href="/admin/" class="btn btn-secondary">
            Cancel
          </Link>
        </div>
      </Form>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Edit Post",
};
