import { component$ } from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  Form,
  z,
  zod$,
  type DocumentHead,
} from "@builder.io/qwik-city";
import { createBookmark, listBookmarks } from "~/lib/db";

export const useBookmarksLoader = routeLoader$(({ url }) => {
  const tags = url.searchParams.getAll("tag");
  return listBookmarks(tags);
});

export const useCreateBookmarkAction = routeAction$(
  async (data) => {
    const tagNames = data.tags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const bookmark = createBookmark(data.url, data.title, tagNames);
    return {
      success: true,
      bookmark,
    };
  },
  zod$({
    url: z.string().min(1),
    title: z.string().min(1),
    tags: z.string().default(""),
  }),
);

export default component$(() => {
  const bookmarks = useBookmarksLoader();
  const createAction = useCreateBookmarkAction();

  return (
    <>
      <h1>Bookmark Manager</h1>

      <Form action={createAction}>
        <div>
          <label>
            URL
            <input type="text" name="url" />
          </label>
        </div>
        <div>
          <label>
            Title
            <input type="text" name="title" />
          </label>
        </div>
        <div>
          <label>
            Tags (comma-separated)
            <input type="text" name="tags" />
          </label>
        </div>
        <button type="submit">Add Bookmark</button>
      </Form>

      <ul>
        {bookmarks.value.map((bookmark) => (
          <li key={bookmark.id} data-testid="bookmark-item">
            <span data-testid="bookmark-title">{bookmark.title}</span>
            {" - "}
            <span data-testid="bookmark-url">{bookmark.url}</span>
            {bookmark.tags.length > 0 && (
              <span> [{bookmark.tags.join(", ")}]</span>
            )}
          </li>
        ))}
      </ul>
    </>
  );
});

export const head: DocumentHead = {
  title: "Bookmark Manager",
  meta: [
    {
      name: "description",
      content: "A tag-filtered bookmark manager built with Qwik City",
    },
  ],
};
