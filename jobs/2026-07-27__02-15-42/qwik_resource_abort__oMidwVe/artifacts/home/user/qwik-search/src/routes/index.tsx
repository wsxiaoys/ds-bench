import { component$, useSignal, useTask$, useResource$, Resource } from '@builder.io/qwik';
import { useLocation } from '@builder.io/qwik-city';

export default component$(() => {
  const searchInput = useSignal('');
  const debouncedQuery = useSignal('');
  const loc = useLocation();

  useTask$(({ track, cleanup }) => {
    const value = track(() => searchInput.value);
    const id = setTimeout(() => {
      debouncedQuery.value = value;
    }, 300);
    cleanup(() => clearTimeout(id));
  });

  const searchResource = useResource$(async ({ track, cleanup }) => {
    const query = track(() => debouncedQuery.value);
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      return { results: [], count: 0, query: trimmed };
    }

    const abortController = new AbortController();
    cleanup(() => abortController.abort('cleanup'));

    const url = new URL('/api/search', loc.url.origin);
    url.searchParams.set('q', trimmed);

    try {
      const response = await fetch(url.toString(), {
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Server error');
      }

      const data = await response.json();
      return data as {
        query: string;
        count: number;
        results: Array<{ id: number; name: string }>;
      };
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message === 'cleanup') {
        throw err;
      }
      throw err;
    }
  });

  const isQueryValid = debouncedQuery.value.trim().length >= 2;

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Qwik Search</h1>
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          data-testid="search-input"
          placeholder="Search languages..."
          value={searchInput.value}
          onInput$={(ev, el) => {
            searchInput.value = el.value;
          }}
          style={{
            padding: '8px 12px',
            fontSize: '16px',
            width: '100%',
            maxWidth: '400px',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {isQueryValid ? (
        <Resource
          value={searchResource}
          onPending={() => (
            <div data-testid="search-pending" style={{ color: '#666' }}>
              Loading...
            </div>
          )}
          onRejected={(err) => (
            <div data-testid="search-error" style={{ color: 'red' }}>
              {err.message || 'An error occurred'}
            </div>
          )}
          onResolved={(data) => (
            <div data-testid="search-results">
              {data.results.length === 0 ? (
                <p>No results found for "{data.query}"</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {data.results.map((item) => (
                    <div
                      key={item.id}
                      data-testid="search-result-item"
                      style={{
                        padding: '10px',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        backgroundColor: '#f9f9f9',
                      }}
                    >
                      {item.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        />
      ) : null}
    </div>
  );
});
