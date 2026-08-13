import { component$, useSignal, useTask$ } from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  Form,
  Link,
  type DocumentHead,
} from "@builder.io/qwik-city";
import { getBookmarks, addBookmark, getAllTags } from "../bookmarkService";

export const useBookmarksData = routeLoader$(({ url }) => {
  const tags = url.searchParams.getAll("tag");
  const bookmarks = getBookmarks(tags);
  const allTags = getAllTags();
  return {
    bookmarks,
    allTags,
    selectedTags: tags,
  };
});

export const useAddBookmark = routeAction$((data) => {
  const urlVal = typeof data.url === "string" ? data.url.trim() : "";
  const titleVal = typeof data.title === "string" ? data.title.trim() : "";
  const tagsStr = typeof data.tags === "string" ? data.tags.trim() : "";

  if (!urlVal || !titleVal) {
    return { success: false, error: "URL and Title are required" };
  }

  const tagsArray = tagsStr
    ? tagsStr
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  try {
    const created = addBookmark(urlVal, titleVal, tagsArray);
    return { success: true, bookmark: created };
  } catch (err: any) {
    return { success: false, error: err?.message || "Database error" };
  }
});

export default component$(() => {
  const data = useBookmarksData();
  const action = useAddBookmark();
  const formRef = useSignal<HTMLFormElement>();

  useTask$(({ track }) => {
    track(() => action.value);
    if (action.value?.success) {
      formRef.value?.reset();
    }
  });

  const getToggleTagUrl = (tag: string, currentTags: string[]) => {
    const nextTags = currentTags.includes(tag)
      ? currentTags.filter((t) => t !== tag)
      : [...currentTags, tag];

    const params = new URLSearchParams();
    nextTags.forEach((t) => params.append("tag", t));
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  };

  return (
    <div class="container">
      <header class="header">
        <h1>🔖 Bookmark Manager</h1>
        <p>A full-stack bookmark manager with Qwik City and SQLite</p>
      </header>

      <main class="main-content">
        {/* Form Section */}
        <section class="card form-section">
          <h2>Add New Bookmark</h2>
          <Form action={action} ref={formRef} class="bookmark-form">
            <div class="form-group">
              <label for="title">Title</label>
              <input
                type="text"
                id="title"
                name="title"
                required
                placeholder="e.g. Qwik Documentation"
              />
            </div>

            <div class="form-group">
              <label for="url">URL</label>
              <input
                type="url"
                id="url"
                name="url"
                required
                placeholder="e.g. https://qwik.dev"
              />
            </div>

            <div class="form-group">
              <label for="tags">Tags (comma-separated)</label>
              <input
                type="text"
                id="tags"
                name="tags"
                placeholder="e.g. js, web, frontend"
              />
            </div>

            <button type="submit" class="btn btn-primary" disabled={action.isRunning}>
              {action.isRunning ? "Adding..." : "Add Bookmark"}
            </button>

            {action.value?.success === false && (
              <p class="error-msg">{action.value.error}</p>
            )}
            {action.value?.success && (
              <p class="success-msg">Bookmark added successfully!</p>
            )}
          </Form>
        </section>

        {/* Filter & List Section */}
        <section class="bookmarks-section">
          <div class="filter-bar">
            <h2>Filter by Tags</h2>
            {data.value.allTags.length === 0 ? (
              <p class="empty-tags">No tags created yet. Add a bookmark with tags to see them here.</p>
            ) : (
              <div class="tag-cloud">
                {data.value.allTags.map((tag) => {
                  const isSelected = data.value.selectedTags.includes(tag);
                  return (
                    <Link
                      key={tag}
                      href={getToggleTagUrl(tag, data.value.selectedTags)}
                      class={`tag-badge ${isSelected ? "selected" : ""}`}
                    >
                      {tag} {isSelected && <span class="remove-tag">×</span>}
                    </Link>
                  );
                })}
                {data.value.selectedTags.length > 0 && (
                  <Link href="/" class="clear-filters">
                    Clear Filters
                  </Link>
                )}
              </div>
            )}
          </div>

          <div class="bookmarks-list">
            <h2>Bookmarks ({data.value.bookmarks.length})</h2>
            {data.value.bookmarks.length === 0 ? (
              <div class="empty-state">
                <p>No bookmarks found matching the selected tags.</p>
              </div>
            ) : (
              <div class="grid">
                {data.value.bookmarks.map((bookmark) => (
                  <div
                    key={bookmark.id}
                    class="card bookmark-item"
                    data-testid="bookmark-item"
                  >
                    <div class="bookmark-content">
                      <h3 class="bookmark-title" data-testid="bookmark-title">
                        {bookmark.title}
                      </h3>
                      <a
                        href={bookmark.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="bookmark-url"
                        data-testid="bookmark-url"
                      >
                        {bookmark.url}
                      </a>
                    </div>
                    {bookmark.tags.length > 0 && (
                      <div class="bookmark-tags">
                        {bookmark.tags.map((tag) => (
                          <span key={tag} class="tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Tag-Filtered Bookmark Manager",
  meta: [
    {
      name: "description",
      content: "Manage bookmarks with tags using Qwik City and SQLite",
    },
  ],
};
