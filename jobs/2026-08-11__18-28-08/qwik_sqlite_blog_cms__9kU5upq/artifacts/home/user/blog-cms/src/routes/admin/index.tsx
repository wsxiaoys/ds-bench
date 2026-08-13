import { component$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, zod$, z, Form, Link, fail } from "@builder.io/qwik-city";
import { getDb } from "../../lib/db.server";
import type { Post } from "../../lib/db.server";

export const useAllPosts = routeLoader$(() => {
  const db = getDb();
  const posts = db
    .prepare("SELECT * FROM posts ORDER BY created_at DESC")
    .all() as Post[];
  return posts;
});

export const useDeletePost = routeAction$(
  async (data) => {
    const db = getDb();
    try {
      const result = db.prepare("DELETE FROM posts WHERE slug = ?").run(data.slug);
      if (result.changes === 0) {
        return fail(404, { message: "Post not found" });
      }
      return { success: true };
    } catch (err: any) {
      return fail(500, { message: err.message || "Failed to delete post" });
    }
  },
  zod$({
    slug: z.string(),
  })
);

export default component$(() => {
  const posts = useAllPosts();
  const deleteAction = useDeletePost();

  return (
    <div class="container">
      <header class="header">
        <h1>Admin Dashboard</h1>
        <nav>
          <Link href="/" class="nav-link">
            View Public Blog
          </Link>
        </nav>
      </header>

      <main>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <h2>All Posts</h2>
          <Link href="/admin/new/" class="btn btn-primary">
            Create New Post
          </Link>
        </div>

        {posts.value.length === 0 ? (
          <p>No posts found. Create your first post!</p>
        ) : (
          <table class="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Slug</th>
                <th>Status</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.value.map((post) => (
                <tr key={post.id}>
                  <td>{post.title}</td>
                  <td><code>{post.slug}</code></td>
                  <td>
                    {post.published === 1 ? (
                      <span class="badge badge-success">Published</span>
                    ) : (
                      <span class="badge badge-secondary">Draft</span>
                    )}
                  </td>
                  <td>{new Date(post.created_at).toLocaleDateString()}</td>
                  <td>
                    <div class="actions-cell">
                      <Link href={`/admin/${post.slug}/edit/`} class="btn btn-secondary" style="font-size: 0.875rem; padding: 0.25rem 0.5rem;">
                        Edit
                      </Link>
                      <Form action={deleteAction}>
                        <input type="hidden" name="slug" value={post.slug} />
                        <button type="submit" class="btn btn-danger" style="font-size: 0.875rem; padding: 0.25rem 0.5rem;" onClick$={(e) => {
                          if (!confirm("Are you sure you want to delete this post?")) {
                            e.preventDefault();
                          }
                        }}>
                          Delete
                        </button>
                      </Form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  );
});

export const head = {
  title: "Admin Dashboard - SQLite Blog",
};
