import { component$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, zod$, Form, Link, type DocumentHead } from "@builder.io/qwik-city";
import { z } from "zod";
import { getAllPosts, deletePostBySlug, type Post } from "../../db.server";

export const useAllPosts = routeLoader$(async () => {
  return getAllPosts();
});

export const useDeletePost = routeAction$(
  async (data) => {
    deletePostBySlug(data.slug);
    return { success: true };
  },
  zod$({
    slug: z.string(),
  })
);

export default component$(() => {
  const postsSignal = useAllPosts();
  const deleteAction = useDeletePost();

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h2>Admin Dashboard</h2>
        <Link href="/admin/new/" class="btn">Create New Post</Link>
      </div>

      {postsSignal.value.length === 0 ? (
        <p>No posts found. Start by creating one!</p>
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
            {postsSignal.value.map((post: Post) => (
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
                  <div class="actions-row">
                    <Link href={`/admin/${post.slug}/edit/`} class="btn btn-secondary btn-sm">
                      Edit
                    </Link>
                    <Form action={deleteAction}>
                      <input type="hidden" name="slug" value={post.slug} />
                      <button
                        type="submit"
                        class="btn btn-danger btn-sm"
                        onClick$={(ev) => {
                          if (!confirm("Are you sure you want to delete this post?")) {
                            ev.preventDefault();
                          }
                        }}
                      >
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
    </div>
  );
});

export const head: DocumentHead = {
  title: "Admin Dashboard",
};
