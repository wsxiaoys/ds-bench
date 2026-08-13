import { component$ } from "@builder.io/qwik";
import { Form, routeAction$, zod$, z, Link } from "@builder.io/qwik-city";
import { getDb } from "../../../lib/db.server";

export const useCreatePost = routeAction$(
  async (data, event) => {
    const db = getDb();

    // Check slug uniqueness
    const existing = db.prepare("SELECT id FROM posts WHERE slug = ?").get(data.slug);
    if (existing) {
      return event.fail(400, {
        fieldErrors: {
          slug: ["Slug must be unique. This slug is already in use."],
        },
      });
    }

    const createdAt = new Date().toISOString();
    const publishedVal = data.published ? 1 : 0;

    try {
      db.prepare(
        "INSERT INTO posts (title, slug, content, published, created_at) VALUES (?, ?, ?, ?, ?)"
      ).run(data.title, data.slug, data.content, publishedVal, createdAt);
    } catch (err: any) {
      return event.fail(500, {
        message: err.message || "Failed to save post to database",
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
  const action = useCreatePost();

  return (
    <div class="container">
      <header class="header">
        <h1>Create New Post</h1>
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
              value={action.formData?.get("title") || ""}
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
              placeholder="e.g., my-new-post"
              value={action.formData?.get("slug") || ""}
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
              value={action.formData?.get("content") || ""}
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
              checked={action.formData?.get("published") === "on"}
            />
            <label for="published">Publish immediately</label>
          </div>

          <div style="display: flex; gap: 1rem; margin-top: 2rem;">
            <button type="submit" class="btn btn-primary">
              Create Post
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
  title: "Create Post - Admin Dashboard",
};
