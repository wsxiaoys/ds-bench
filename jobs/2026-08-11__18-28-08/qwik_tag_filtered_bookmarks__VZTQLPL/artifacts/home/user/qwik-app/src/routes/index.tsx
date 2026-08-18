import { component$, useSignal, useVisibleTask$ } from '@builder.io/qwik';
import { routeLoader$, routeAction$, Form, useLocation, type DocumentHead } from '@builder.io/qwik-city';
import { getBookmarks, getAllTags, createBookmark } from '../lib/db';

export const useBookmarks = routeLoader$(({ url }) => {
  const tags = url.searchParams.getAll('tag').map(t => t.trim()).filter(Boolean);
  return getBookmarks(tags);
});

export const useAllTags = routeLoader$(() => {
  return getAllTags();
});

export const useCreateBookmark = routeAction$(async (data) => {
  const url = data.url as string;
  const title = data.title as string;
  const tags = data.tags as string;

  if (!url || typeof url !== 'string' || url.trim() === '') {
    return { success: false, error: 'URL is required' };
  }
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return { success: false, error: 'Title is required' };
  }

  const tagsArray = tags
    ? tags.split(',').map(t => t.trim()).filter(Boolean)
    : [];

  try {
    const bookmark = createBookmark(url, title, tagsArray);
    return { success: true, bookmark };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

export default component$(() => {
  const bookmarks = useBookmarks();
  const allTags = useAllTags();
  const action = useCreateBookmark();
  const loc = useLocation();
  const formRef = useSignal<HTMLFormElement>();

  // Get active tags from the query parameters
  const activeTags = loc.url.searchParams.getAll('tag').map(t => t.trim()).filter(Boolean);

  // Reset form on successful bookmark creation
  useVisibleTask$(({ track }) => {
    track(() => action.value);
    if (action.value?.success) {
      formRef.value?.reset();
    }
  });

  // Helper to generate URLs for toggling tags
  const getToggleTagUrl = (tag: string) => {
    const nextTags = activeTags.includes(tag)
      ? activeTags.filter(t => t !== tag)
      : [...activeTags, tag];

    const params = new URLSearchParams();
    nextTags.forEach(t => params.append('tag', t));
    const search = params.toString();
    return search ? `/?${search}` : '/';
  };

  return (
    <div class="container">
      <header>
        <h1>🔖 Tag-Filtered Bookmark Manager</h1>
        <p class="subtitle">Organize and filter your bookmarks with local SQLite database</p>
      </header>

      <div class="layout">
        <aside class="sidebar">
          <h2>Filter by Tags</h2>
          {allTags.value.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No tags created yet.</p>
          ) : (
            <div class="tags-list">
              {allTags.value.map(tag => {
                const isActive = activeTags.includes(tag);
                return (
                  <a
                    key={tag}
                    href={getToggleTagUrl(tag)}
                    class={`tag-filter-btn ${isActive ? 'active' : ''}`}
                  >
                    <span>#{tag}</span>
                    <span>{isActive ? '✕' : ''}</span>
                  </a>
                );
              })}
            </div>
          )}

          {activeTags.length > 0 && (
            <a href="/" class="clear-btn">
              Clear Filters ({activeTags.length})
            </a>
          )}
        </aside>

        <main class="main-content">
          <section class="card">
            <h2>Add New Bookmark</h2>
            
            {action.value && !action.value.success && (
              <div class="error-msg">{action.value.error}</div>
            )}
            {action.value && action.value.success && (
              <div class="success-msg">Bookmark added successfully!</div>
            )}

            <Form ref={formRef} action={action}>
              <div class="form-group">
                <label for="title">Title</label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  class="form-control"
                  placeholder="e.g. Qwik Framework"
                  required
                />
              </div>

              <div class="form-group">
                <label for="url">URL</label>
                <input
                  type="url"
                  id="url"
                  name="url"
                  class="form-control"
                  placeholder="e.g. https://qwik.dev"
                  required
                />
              </div>

              <div class="form-group">
                <label for="tags">Tags (comma-separated)</label>
                <input
                  type="text"
                  id="tags"
                  name="tags"
                  class="form-control"
                  placeholder="e.g. js, web, frontend"
                />
              </div>

              <button type="submit" class="btn-primary">
                Add Bookmark
              </button>
            </Form>
          </section>

          <section>
            <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>
              {activeTags.length > 0
                ? `Bookmarks matching: ${activeTags.map(t => `#${t}`).join(' AND ')}`
                : 'All Bookmarks'}
              {` (${bookmarks.value.length})`}
            </h2>

            {bookmarks.value.length === 0 ? (
              <div class="no-bookmarks">
                <p>No bookmarks found.</p>
              </div>
            ) : (
              <div class="bookmarks-list">
                {bookmarks.value.map(bookmark => (
                  <div
                    key={bookmark.id}
                    data-testid="bookmark-item"
                    class="bookmark-item"
                  >
                    <h3 class="bookmark-title">
                      <a href={bookmark.url} target="_blank" rel="noopener noreferrer">
                        <span data-testid="bookmark-title">{bookmark.title}</span>
                      </a>
                    </h3>
                    <div data-testid="bookmark-url" class="bookmark-url">
                      {bookmark.url}
                    </div>
                    {bookmark.tags.length > 0 && (
                      <div class="bookmark-tags">
                        {bookmark.tags.map(tag => (
                          <span key={tag} class="bookmark-tag">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Tag-Filtered Bookmark Manager",
  meta: [
    {
      name: "description",
      content: "A local bookmark manager with tag-filtering using Qwik City & SQLite",
    },
  ],
};
