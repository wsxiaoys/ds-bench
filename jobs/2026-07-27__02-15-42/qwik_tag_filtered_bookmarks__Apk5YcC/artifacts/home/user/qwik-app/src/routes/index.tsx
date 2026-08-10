import { component$ } from '@builder.io/qwik';
import { routeLoader$, routeAction$, zod$, z, Form } from '@builder.io/qwik-city';
import { getBookmarks, createBookmark, getAllTags } from '../db';

export const useBookmarksLoader = routeLoader$(({ url }) => {
  const tags = url.searchParams.getAll('tag');
  const bookmarks = getBookmarks(tags);
  const allTags = getAllTags();
  return {
    bookmarks,
    allTags,
    selectedTags: tags
  };
});

export const useCreateBookmarkAction = routeAction$(
  (data) => {
    const { url, title, tags } = data;
    const tagsArray = tags
      ? tags.split(',').map(t => t.trim()).filter(Boolean)
      : [];
    return createBookmark(url, title, tagsArray);
  },
  zod$({
    url: z.string().min(1, 'URL is required'),
    title: z.string().min(1, 'Title is required'),
    tags: z.string().optional()
  })
);

export default component$(() => {
  const loader = useBookmarksLoader();
  const action = useCreateBookmarkAction();

  return (
    <div>
      <h1>Tag-Filtered Bookmark Manager</h1>

      <section>
        <h2>Create a Bookmark</h2>
        <Form action={action}>
          <label>
            Title
            <input type="text" name="title" required />
          </label>
          <label>
            URL
            <input type="text" name="url" required />
          </label>
          <label>
            Tags (comma-separated)
            <input type="text" name="tags" placeholder="e.g. js, web, frontend" />
          </label>
          <button type="submit">Add Bookmark</button>
          {action.value?.id && <p style={{ color: 'green' }}>Bookmark added successfully!</p>}
        </Form>
      </section>

      <section>
        <h2>Filter by Tags</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          {loader.value.allTags.map((tag: string) => {
            const isSelected = loader.value.selectedTags.includes(tag);
            const params = new URLSearchParams();
            let newTags = [...loader.value.selectedTags];
            if (isSelected) {
              newTags = newTags.filter(t => t !== tag);
            } else {
              newTags.push(tag);
            }
            newTags.forEach(t => params.append('tag', t));
            const href = params.toString() ? `/?${params.toString()}` : '/';

            return (
              <a
                key={tag}
                href={href}
                class={`tag ${isSelected ? 'selected' : ''}`}
                style={{
                  textDecoration: 'none',
                  display: 'inline-block',
                }}
              >
                {tag} {isSelected ? '✓' : ''}
              </a>
            );
          })}
          {loader.value.selectedTags.length > 0 && (
            <a href="/" style={{ color: 'red', textDecoration: 'none', alignSelf: 'center' }}>
              Clear Filters
            </a>
          )}
        </div>
      </section>

      <section>
        <h2>Bookmarks</h2>
        {loader.value.bookmarks.length === 0 ? (
          <p>No bookmarks found.</p>
        ) : (
          <div class="bookmark-list">
            {loader.value.bookmarks.map((bookmark) => (
              <div key={bookmark.id} class="bookmark-item" data-testid="bookmark-item">
                <h3 data-testid="bookmark-title">{bookmark.title}</h3>
                <p>
                  <a href={bookmark.url} target="_blank" rel="noopener noreferrer" data-testid="bookmark-url">
                    {bookmark.url}
                  </a>
                </p>
                <div class="tags">
                  {bookmark.tags.map((tag: string) => (
                    <span key={tag} class="tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
});
