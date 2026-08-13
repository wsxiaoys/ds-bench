import { component$, useSignal, useTask$, useResource$, Resource } from '@builder.io/qwik';

interface SearchResultItem {
  id: number;
  name: string;
}

interface SearchResult {
  query: string;
  count: number;
  results: SearchResultItem[];
}

export default component$(() => {
  const inputValue = useSignal('');
  const debouncedQuery = useSignal('');

  // Debounce input value by 300ms
  useTask$(({ track, cleanup }) => {
    const value = track(inputValue);
    const id = setTimeout(() => {
      debouncedQuery.value = value;
    }, 300);
    cleanup(() => clearTimeout(id));
  });

  // Async resource tracking the debounced query
  const searchResource = useResource$<SearchResult | null>(async ({ track, cleanup }) => {
    const query = track(debouncedQuery);
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      return null;
    }

    const abortController = new AbortController();
    cleanup(() => abortController.abort());

    const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
      signal: abortController.signal,
    });

    if (!res.ok) {
      throw new Error('Search failed');
    }

    return res.json();
  });

  const showResource = debouncedQuery.value.trim().length >= 2;

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Qwik Dev Search</h1>
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          data-testid="search-input"
          value={inputValue.value}
          onInput$={(ev, el) => {
            inputValue.value = el.value;
          }}
          placeholder="Type to search..."
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '16px',
            borderRadius: '4px',
            border: '1px solid #ccc',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {showResource && (
        <Resource
          value={searchResource}
          onPending={() => (
            <div data-testid="search-pending" style={{ color: '#666', fontStyle: 'italic' }}>
              Searching...
            </div>
          )}
          onRejected={() => (
            <div data-testid="search-error" style={{ color: 'red', fontWeight: 'bold' }}>
              Error: Search failed.
            </div>
          )}
          onResolved={(data) => {
            if (!data || data.results.length === 0) {
              return (
                <div data-testid="search-results" style={{ color: '#666' }}>
                  No results found.
                </div>
              );
            }
            return (
              <div
                data-testid="search-results"
                style={{
                  border: '1px solid #eee',
                  borderRadius: '4px',
                  backgroundColor: '#f9f9f9'
                }}
              >
                {data.results.map((result) => (
                  <div
                    key={result.id}
                    data-testid="search-result-item"
                    style={{
                      padding: '10px 15px',
                      borderBottom: '1px solid #eee'
                    }}
                  >
                    {result.name}
                  </div>
                ))}
              </div>
            );
          }}
        />
      )}
    </div>
  );
});
