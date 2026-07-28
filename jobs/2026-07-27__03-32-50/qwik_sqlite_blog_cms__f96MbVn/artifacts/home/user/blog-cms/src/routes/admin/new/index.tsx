import { component$ } from "@builder.io/qwik";
import { Form, Link, routeAction$, z, zod$ } from "@builder.io/qwik-city";
import type { DocumentHead } from "@builder.io/qwik-city";
import { createPost } from "~/lib/db.server";

export const useCreatePost = routeAction$(
  (data, { redirect }) => {
    const result = createPost({
      slug: data.slug,
      title: data.title,
      content: data.content,
      published: data.published,
    });
    if (!result.success) {
      return { success: false as const, message: result.error };
    }
    throw redirect(303, "/admin/");
  },
  zod$({
    title: z.string().min(3, "Title must be at least 3 characters long."),
    slug: z
      .string()
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug must be lowercase kebab-case (e.g. my-post-title).",
      ),
    content: z.string().min(1, "Content is required."),
    published: z
      .string()
      .optional()
      .transform((val) => val === "true"),
  }),
);

export default component$(() => {
  const action = useCreatePost();

  return (
    <>
      <h1>New Post</h1>
      <Form action={action}>
        <div>
          <label for="title">Title</label>
          <br />
          <input
            id="title"
            type="text"
            name="title"
            value={action.formData?.get("title")?.toString() ?? ""}
          />
          {action.value?.fieldErrors?.title && (
            <p style={{ color: "red" }}>{action.value.fieldErrors.title}</p>
          )}
        </div>
        <div>
          <label for="slug">Slug</label>
          <br />
          <input
            id="slug"
            type="text"
            name="slug"
            value={action.formData?.get("slug")?.toString() ?? ""}
          />
          {action.value?.fieldErrors?.slug && (
            <p style={{ color: "red" }}>{action.value.fieldErrors.slug}</p>
          )}
        </div>
        <div>
          <label for="content">Content</label>
          <br />
          <textarea id="content" name="content" rows={10} cols={60}>
            {action.formData?.get("content")?.toString() ?? ""}
          </textarea>
          {action.value?.fieldErrors?.content && (
            <p style={{ color: "red" }}>{action.value.fieldErrors.content}</p>
          )}
        </div>
        <div>
          <label>
            <input
              type="checkbox"
              name="published"
              value="true"
              checked={action.formData?.get("published") === "true"}
            />{" "}
            Published
          </label>
        </div>

        {action.value?.success === false && (
          <p style={{ color: "red" }}>{action.value.message}</p>
        )}

        <button type="submit">Create Post</button>
      </Form>
      <p>
        <Link href="/admin/">Back to admin</Link>
      </p>
    </>
  );
});

export const head: DocumentHead = {
  title: "New Post - Admin",
};
