import { component$ } from "@builder.io/qwik";
import { routeAction$, zod$, Form, Link, type DocumentHead } from "@builder.io/qwik-city";
import { z } from "zod";
import { createPost, getPostBySlug } from "../../../db.server";

export const useCreatePost = routeAction$(
  async (data, { fail, redirect }) => {
    // Check slug uniqueness
    const existing = getPostBySlug(data.slug);
    if (existing) {
      return fail(400, {
        fieldErrors: {
          slug: ["Slug must be unique. A post with this slug already exists."],
        },
      });
    }

    try {
      createPost({
        slug: data.slug,
        title: data.title,
        content: data.content,
        published: data.published ? 1 : 0,
      });
    } catch (err: any) {
      return fail(500, {
        message: "Failed to create post: " + err.message,
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
  const action = useCreatePost();
  const fieldErrors = action.value?.fieldErrors as Record<string, string[] | undefined> | undefined;

  return (
    <div>
      <h2>Create New Post</h2>

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
            value={(action.formData?.get("title") as string) ?? ""}
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
            value={(action.formData?.get("slug") as string) ?? ""}
            placeholder="my-new-post"
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
            value={(action.formData?.get("content") as string) ?? ""}
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
            checked={action.formData ? action.formData.get("published") === "on" : false}
          />
          <label for="published">Publish immediately</label>
        </div>

        <div class="actions-row">
          <button type="submit" class="btn">
            {action.isRunning ? "Creating..." : "Create Post"}
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
  title: "Create New Post",
};
