import { component$, useSignal } from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  Form,
  useLocation,
} from "@builder.io/qwik-city";
import type { DocumentHead } from "@builder.io/qwik-city";
import { getBookmarks, insertBookmarkWithTags, db } from "../lib/db";

// Loader to fetch bookmarks, filtered by tags if provided
export const useBookmarks = routeLoader$(async ({ url }) => {
  const filterTags = url.searchParams.getAll("tag");
  return getBookmarks(filterTags);
});

// Loader to fetch all unique tags for the filter UI
export const useAllTags = routeLoader$(async () => {
  try {
    const rows = db
      .prepare("SELECT name FROM tags ORDER BY name ASC")
      .all() as { name: string }[];
    return rows.map((r) => r.name);
  } catch {
    return [];
  }
});

// Action to handle bookmark creation
export const useCreateBookmark = routeAction$(async (data, { fail }) => {
  const url = typeof data.url === "string" ? data.url.trim() : "";
  const title = typeof data.title === "string" ? data.title.trim() : "";
  const tagsString = typeof data.tags === "string" ? data.tags : "";

  if (!url || !title) {
    return fail(400, {
      message: "URL and Title are required.",
    });
  }

  const tags = tagsString
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  try {
    const bookmark = insertBookmarkWithTags(url, title, tags);
    return { success: true, bookmark };
  } catch (error: any) {
    return fail(500, {
      message: error.message || "Failed to create bookmark.",
    });
  }
});

export default component$(() => {
  const bookmarksSignal = useBookmarks();
  const tagsSignal = useAllTags();
  const createAction = useCreateBookmark();
  const loc = useLocation();

  const currentTags = loc.url.searchParams.getAll("tag");
  const formRef = useSignal<HTMLFormElement>();

  // Helper to build toggle tag URLs
  const getTagToggleUrl = (tag: string) => {
    const params = new URLSearchParams();
    let isAlreadySelected = false;

    for (const t of currentTags) {
      if (t === tag) {
        isAlreadySelected = true;
      } else {
        params.append("tag", t);
      }
    }

    if (!isAlreadySelected) {
      params.append("tag", tag);
    }

    const search = params.toString();
    return search ? `/?${search}` : "/";
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px", fontFamily: "sans-serif" }}>
      <header style={{ borderBottom: "1px solid #eee", paddingBottom: "20px", marginBottom: "20px" }}>
        <h1 style={{ margin: "0 0 10px 0", color: "#333" }}>🏷️ Tag-Filtered Bookmark Manager</h1>
        <p style={{ margin: 0, color: "#666" }}>
          Filter bookmarks by one or multiple tags (AND semantics).
        </p>
      </header>

      <div style={{ display: "flex", gap: "30px", flexWrap: "wrap" }}>
        {/* Left Side: Creation Form & Filter Status */}
        <div style={{ flex: "1 1 300px", minWidth: "300px" }}>
          <section style={{ background: "#f9f9f9", padding: "20px", borderRadius: "8px", marginBottom: "20px" }}>
            <h2 style={{ marginTop: 0, fontSize: "1.2rem", color: "#444" }}>Add New Bookmark</h2>
            
            <Form
              ref={formRef}
              action={createAction}
              onSubmitCompleted$={() => {
                if (createAction.value && !createAction.value.failed) {
                  formRef.value?.reset();
                }
              }}
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold", fontSize: "0.9rem" }}>
                  Title
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="e.g. Qwik Framework"
                  style={{ width: "100%", padding: "8px", boxSizing: "border-box", borderRadius: "4px", border: "1px solid #ccc" }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold", fontSize: "0.9rem" }}>
                  URL
                </label>
                <input
                  type="text"
                  name="url"
                  required
                  placeholder="e.g. https://qwik.dev"
                  style={{ width: "100%", padding: "8px", boxSizing: "border-box", borderRadius: "4px", border: "1px solid #ccc" }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold", fontSize: "0.9rem" }}>
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  name="tags"
                  placeholder="e.g. js, web, frontend"
                  style={{ width: "100%", padding: "8px", boxSizing: "border-box", borderRadius: "4px", border: "1px solid #ccc" }}
                />
              </div>

              <button
                type="submit"
                style={{
                  padding: "10px",
                  background: "#0070f3",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                {createAction.isRunning ? "Adding..." : "Add Bookmark"}
              </button>

              {createAction.value?.failed && (
                <div style={{ color: "red", fontSize: "0.9rem", marginTop: "5px" }}>
                  Error: {createAction.value.message}
                </div>
              )}
            </Form>
          </section>

          {/* Filter Section */}
          <section style={{ background: "#f0f7ff", padding: "20px", borderRadius: "8px" }}>
            <h2 style={{ marginTop: 0, fontSize: "1.2rem", color: "#0056b3" }}>Filter by Tags</h2>
            
            {tagsSignal.value.length === 0 ? (
              <p style={{ margin: 0, color: "#666", fontSize: "0.9rem" }}>No tags created yet.</p>
            ) : (
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {tagsSignal.value.map((tag) => {
                  const isSelected = currentTags.includes(tag);
                  return (
                    <a
                      key={tag}
                      href={getTagToggleUrl(tag)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "16px",
                        fontSize: "0.85rem",
                        textDecoration: "none",
                        fontWeight: isSelected ? "bold" : "normal",
                        background: isSelected ? "#0070f3" : "#e0e0e0",
                        color: isSelected ? "white" : "#333",
                        display: "inline-block",
                        transition: "background 0.2s",
                      }}
                    >
                      {tag} {isSelected ? "✓" : ""}
                    </a>
                  );
                })}
              </div>
            )}

            {currentTags.length > 0 && (
              <div style={{ marginTop: "15px" }}>
                <a
                  href="/"
                  style={{
                    fontSize: "0.9rem",
                    color: "#0070f3",
                    textDecoration: "underline",
                  }}
                >
                  Clear all filters
                </a>
              </div>
            )}
          </section>
        </div>

        {/* Right Side: Bookmark List */}
        <div style={{ flex: "2 1 400px", minWidth: "300px" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.4rem", color: "#333", borderBottom: "2px solid #eee", paddingBottom: "8px" }}>
            Bookmarks ({bookmarksSignal.value.length})
          </h2>

          {currentTags.length > 0 && (
            <div style={{ marginBottom: "15px", fontSize: "0.9rem", color: "#666" }}>
              Showing bookmarks with ALL tags:{" "}
              {currentTags.map((t, idx) => (
                <strong key={t} style={{ color: "#333" }}>
                  {t}
                  {idx < currentTags.length - 1 ? ", " : ""}
                </strong>
              ))}
            </div>
          )}

          {bookmarksSignal.value.length === 0 ? (
            <p style={{ color: "#666", fontStyle: "italic" }}>No bookmarks found matching the criteria.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              {bookmarksSignal.value.map((bookmark) => (
                <div
                  key={bookmark.id}
                  data-testid="bookmark-item"
                  style={{
                    padding: "15px",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    background: "white",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
                  }}
                >
                  <h3
                    data-testid="bookmark-title"
                    style={{ margin: "0 0 6px 0", fontSize: "1.15rem", color: "#111" }}
                  >
                    {bookmark.title}
                  </h3>
                  
                  <div style={{ marginBottom: "10px" }}>
                    <a
                      href={bookmark.url}
                      data-testid="bookmark-url"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#0070f3", textDecoration: "none", fontSize: "0.95rem", wordBreak: "break-all" }}
                    >
                      {bookmark.url}
                    </a>
                  </div>

                  {bookmark.tags.length > 0 && (
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      {bookmark.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            background: "#f1f1f1",
                            color: "#555",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                          }}
                        >
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
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Tag-Filtered Bookmark Manager",
  meta: [
    {
      name: "description",
      content: "Manage and filter your bookmarks by multiple tags locally.",
    },
  ],
};
