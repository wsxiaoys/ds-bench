import { component$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, Link, type DocumentHead } from "@builder.io/qwik-city";
import { zod$, z } from "@builder.io/qwik-city";
import { getAllPosts, deletePost } from "../../db.server";

export const useAllPosts = routeLoader$(() => {
  return getAllPosts();
});

export const useDeletePost = routeAction$(
  async (data) => {
    deletePost(data.slug);
    return { success: true };
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h2>Admin Dashboard</h2>
          <Link href="/admin/new/" class="btn">
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
                      <span class="badge badge-published">Published</span>
                    ) : (
                      <span class="badge badge-draft">Draft</span>
                    )}
                  </td>
                  <td>{new Date(post.created_at).toLocaleDateString()}</td>
                  <td>
                    <div class="actions-cell">
                      <Link href={`/admin/${post.slug}/edit/`} class="btn btn-secondary" style={{ padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}>
                        Edit
                      </Link>
                      <Form action={deleteAction}>
                        <input type="hidden" name="slug" value={post.slug} />
                        <button type="submit" class="btn btn-danger" style={{ padding: "0.25rem 0.5rem", fontSize: "0.875rem" }} onClick$={(e) => {
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

export const head: DocumentHead = {
  title: "Admin Dashboard - Local SQLite Blog",
};
