import { component$ } from "@builder.io/qwik";
import {
  Form,
  Link,
  routeAction$,
  routeLoader$,
  z,
  zod$,
} from "@builder.io/qwik-city";
import type { DocumentHead } from "@builder.io/qwik-city";
import { deletePost, listAllPosts } from "~/lib/db.server";

export const useAllPosts = routeLoader$(() => {
  return listAllPosts();
});

export const useDeletePost = routeAction$(
  (data) => {
    const result = deletePost(data.slug);
    if (!result.success) {
      return { success: false as const, message: result.error };
    }
    return { success: true as const };
  },
  zod$({
    slug: z.string().min(1),
  }),
);

export default component$(() => {
  const posts = useAllPosts();
  const deleteAction = useDeletePost();

  return (
    <>
      <h1>Admin</h1>
      <p>
        <Link href="/admin/new/">+ Create new post</Link>
      </p>

      {deleteAction.value?.success === false && (
        <p style={{ color: "red" }}>{deleteAction.value.message}</p>
      )}

      {posts.value.length === 0 ? (
        <p>No posts yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Slug</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {posts.value.map((post) => (
              <tr key={post.id}>
                <td>{post.title}</td>
                <td>{post.slug}</td>
                <td>{post.published ? "Published" : "Draft"}</td>
                <td>{post.created_at}</td>
                <td>
                  <Link href={`/admin/${post.slug}/edit/`}>Edit</Link>{" "}
                  <Form action={deleteAction} style={{ display: "inline" }}>
                    <input type="hidden" name="slug" value={post.slug} />
                    <button type="submit">Delete</button>
                  </Form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
});

export const head: DocumentHead = {
  title: "Admin - Blog",
};
