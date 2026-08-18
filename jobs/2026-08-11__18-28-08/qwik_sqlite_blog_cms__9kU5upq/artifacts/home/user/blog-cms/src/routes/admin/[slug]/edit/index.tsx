import { component$ } from "@builder.io/qwik";
import { Form, routeLoader$, routeAction$, zod$, z, Link } from "@builder.io/qwik-city";
import { getDb } from "../../../../lib/db.server";
import type { Post } from "../../../../lib/db.server";

export const useEditPost = routeLoader$(({ params, status }) => {
  const db = getDb();
  const post = db
    .prepare("SELECT * FROM posts WHERE slug = ?")
    .get(params.slug) as Post | undefined;

  if (!post) {
    status(404);
    return null;
  }

  return post;
});

export const useUpdatePost = routeAction$(
  async (data, event) => {
    const db = getDb();

    // Fetch the post being edited (using original slug from params)
    const currentPost = db
      .prepare("SELECT * FROM posts WHERE slug = ?")
      .get(event.params.slug) as Post | undefined;

    if (!currentPost) {
      return event.fail(404, { message: "Post not found" });
    }

    // Check slug uniqueness if slug is being changed
    if (data.slug !== currentPost.slug) {
      const existing = db.prepare("SELECT id FROM posts WHERE slug = ?").get(data.slug);
      if (existing) {
        return event.fail(400, {
          fieldErrors: {
            slug: ["Slug must be unique. This slug is already in use by another post."],
          },
        });
      }
    }

    const publishedVal = data.published ? 1 : 0;

    try {
      db.prepare(
        "UPDATE posts SET title = ?, slug = ?, content = ?, published = ? WHERE id = ?"
      ).run(data.title, data.slug, data.content, publishedVal, currentPost.id);
    } catch (err: any) {
      return event.fail(500, {
        message: err.message || "Failed to update post in database",
      });
    }

    throw event.redirect(303, "/admin/");
  },
  zod$({
    title: z.string().min(3, "Title must be at least 3 characters"),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be kebab-case (e.g., 'my-post-slug')"),
    content: z.string().min(1, "Content must be at least 1 character"),
    published: z.preprocess((val) => val === "on" || val === "true" || val === true, z.boolean()),
  })
);

export default component$(() => {
  const postSignal = useEditPost();
  const action = useUpdatePost();

  if (!postSignal.value) {
    return (
      <div class="container">
        <div class="alert-danger">
          <h2>404 - Post Not Found</h2>
          <p>The post you are trying to edit does not exist.</p>
        </div>
        <Link href="/admin/" class="btn btn-primary">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const post = postSignal.value;

  // Pre-fill form fields with submitted data (if validation failed) or original post data
  const titleValue = action.formData?.get("title") !== undefined
    ? (action.formData.get("title") as string)
    : post.title;

  const slugValue = action.formData?.get("slug") !== undefined
    ? (action.formData.get("slug") as string)
    : post.slug;

  const contentValue = action.formData?.get("content") !== undefined
    ? (action.formData.get("content") as string)
    : post.content;

  const publishedValue = action.formData?.get("published") !== undefined
    ? action.formData.get("published") === "on"
    : post.published === 1;

  return (
    <div class="container">
      <header class="header">
        <h1>Edit Post</h1>
        <nav>
          <Link href="/admin/" class="nav-link">
            Back to Dashboard
          </Link>
        </nav>
      </header>

      <main>
        {action.value?.failed && action.value?.message && (
          <div class="alert-danger">{action.value.message}</div>
        )}

        <Form action={action} class="admin-form">
          <div class="form-group">
            <label for="title">Title</label>
            <input
              type="text"
              id="title"
              name="title"
              class="form-control"
              placeholder="Post Title"
              value={titleValue}
            />
            {action.value?.fieldErrors?.title && (
              <div class="error-message">{action.value.fieldErrors.title[0]}</div>
            )}
          </div>

          <div class="form-group">
            <label for="slug">Slug (kebab-case)</label>
            <input
              type="text"
              id="slug"
              name="slug"
              class="form-control"
              placeholder="e.g., my-post-slug"
              value={slugValue}
            />
            {action.value?.fieldErrors?.slug && (
              <div class="error-message">{action.value.fieldErrors.slug[0]}</div>
            )}
          </div>

          <div class="form-group">
            <label for="content">Content</label>
            <textarea
              id="content"
              name="content"
              class="form-control"
              placeholder="Write your post content here..."
              value={contentValue}
            ></textarea>
            {action.value?.fieldErrors?.content && (
              <div class="error-message">{action.value.fieldErrors.content[0]}</div>
            )}
          </div>

          <div class="form-group checkbox-group">
            <input
              type="checkbox"
              id="published"
              name="published"
              checked={publishedValue}
            />
            <label for="published">Published</label>
          </div>

          <div style="display: flex; gap: 1rem; margin-top: 2rem;">
            <button type="submit" class="btn btn-primary">
              Save Changes
            </button>
            <Link href="/admin/" class="btn btn-secondary">
              Cancel
            </Link>
          </div>
        </Form>
      </main>
    </div>
  );
});

export const head = {
  title: "Edit Post - Admin Dashboard",
};
