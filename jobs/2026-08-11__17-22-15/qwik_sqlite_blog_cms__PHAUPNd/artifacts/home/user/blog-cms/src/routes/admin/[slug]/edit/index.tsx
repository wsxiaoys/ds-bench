import { component$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, Link, type DocumentHead } from "@builder.io/qwik-city";
import { zod$, z } from "@builder.io/qwik-city";
import { getPostBySlug, updatePost } from "../../../../db.server";

export const usePost = routeLoader$(({ params, status }) => {
  const post = getPostBySlug(params.slug);
  if (!post) {
    status(404);
    return null;
  }
  return post;
});

export const useUpdatePost = routeAction$(
  async (data, { params, fail, redirect }) => {
    const existing = getPostBySlug(params.slug);
    if (!existing) {
      return fail(404, {
        failed: true,
        message: "Post not found.",
      });
    }

    // Check slug uniqueness if the slug has changed
    if (data.slug !== params.slug) {
      const slugConflict = getPostBySlug(data.slug);
      if (slugConflict) {
        return fail(400, {
          failed: true,
          fieldErrors: {
            title: undefined as string[] | undefined,
            slug: ["A post with this slug already exists."] as string[] | undefined,
            content: undefined as string[] | undefined,
          },
        });
      }
    }

    try {
      updatePost(params.slug, {
        title: data.title,
        slug: data.slug,
        content: data.content,
        published: data.published ? 1 : 0,
      });
    } catch (err: any) {
      if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
        return fail(400, {
          failed: true,
          fieldErrors: {
            title: undefined as string[] | undefined,
            slug: ["A post with this slug already exists."] as string[] | undefined,
            content: undefined as string[] | undefined,
          },
        });
      }
      return fail(500, {
        failed: true,
        message: "An unexpected database error occurred.",
      });
    }

    throw redirect(303, "/admin/");
  },
  zod$({
    title: z.string().min(3, { message: "Title must be at least 3 characters." }),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      message: "Slug must be kebab-case (lowercase letters, numbers, and hyphens only, e.g., 'my-post-slug').",
    }),
    content: z.string().min(1, { message: "Content must be at least 1 character." }),
    published: z.preprocess((val) => val === "on" || val === "true" || val === true, z.boolean()),
  })
);

export default component$(() => {
  const postSignal = usePost();
  const action = useUpdatePost();

  if (!postSignal.value) {
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
          <h2>Post Not Found</h2>
          <p>The post you are trying to edit does not exist.</p>
          <Link href="/admin/" class="back-link">
            &larr; Back to Dashboard
          </Link>
        </main>
      </div>
    );
  }

  const post = postSignal.value;

  const titleValue = (action.formData?.get("title") as string) ?? post.title;
  const slugValue = (action.formData?.get("slug") as string) ?? post.slug;
  const contentValue = (action.formData?.get("content") as string) ?? post.content;
  const publishedValue = action.formData ? action.formData.get("published") === "on" : post.published === 1;

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
        <Link href="/admin/" class="back-link">
          &larr; Back to Dashboard
        </Link>
        <h2>Edit Post: {post.title}</h2>

        {action.value?.failed && !action.value?.fieldErrors && (
          <div class="error-summary">
            <strong>Error:</strong> {action.value?.message || "Something went wrong."}
          </div>
        )}

        <Form action={action} class="post-form">
          <div class="form-group">
            <label for="title">Title</label>
            <input
              type="text"
              id="title"
              name="title"
              class="form-control"
              value={titleValue}
              placeholder="Post Title"
            />
            {action.value?.fieldErrors?.title && (
              <div class="error-message">{action.value.fieldErrors.title[0]}</div>
            )}
          </div>

          <div class="form-group">
            <label for="slug">Slug</label>
            <input
              type="text"
              id="slug"
              name="slug"
              class="form-control"
              value={slugValue}
              placeholder="my-post-slug"
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
              rows={8}
              class="form-control"
              value={contentValue}
              placeholder="Write your post content here..."
            />
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

          <div style={{ display: "flex", gap: "1rem", marginTop: "2rem" }}>
            <button type="submit" class="btn">
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

export const head: DocumentHead = ({ resolveValue }) => {
  const post = resolveValue(usePost);
  if (!post) {
    return {
      title: "Edit Post Not Found",
    };
  }
  return {
    title: `Edit Post: ${post.title}`,
  };
};
