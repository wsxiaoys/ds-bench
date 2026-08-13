import { component$, useSignal, useTask$, useResource$, Resource } from '@builder.io/qwik';
import { isServer } from '@builder.io/qwik/build';

export default component$(() => {
  const querySignal = useSignal('');
  const debouncedQuerySignal = useSignal('');

  // Debounce task: wait 300ms after typing stops before updating debouncedQuerySignal
  useTask$(({ track, cleanup }) => {
    const value = track(() => querySignal.value);
    if (isServer) {
      return;
    }
    const id = setTimeout(() => {
      debouncedQuerySignal.value = value;
    }, 300);
    cleanup(() => clearTimeout(id));
  });

  // Resource for fetching search results
  const searchResource = useResource$(async ({ track, cleanup }) => {
    const query = track(() => debouncedQuerySignal.value);
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      return null;
    }

    const abortController = new AbortController();
    cleanup(() => abortController.abort());

    try {
      const url = `/api/search?q=${encodeURIComponent(trimmed)}`;
      const res = await fetch(url, {
        signal: abortController.signal,
      });

      if (!res.ok) {
        throw new Error('Search failed');
      }

      return await res.json();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Return a pending promise to prevent aborted requests from triggering rejection state
        return new Promise(() => {});
      }
      throw err;
    }
  });

  const showResults = debouncedQuerySignal.value.trim().length >= 2;

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Qwik Search</h1>
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          data-testid="search-input"
          value={querySignal.value}
          onInput$={(ev, el) => {
            querySignal.value = el.value;
          }}
          placeholder="Type to search..."
          style={{
            padding: '8px 12px',
            fontSize: '16px',
            width: '100%',
            maxWidth: '400px',
            borderRadius: '4px',
            border: '1px solid #ccc',
          }}
        />
      </div>

      {showResults && (
        <Resource
          value={searchResource}
          onPending={() => (
            <div data-testid="search-pending" style={{ color: '#666' }}>
              Loading...
            </div>
          )}
          onRejected={(error) => (
            <div data-testid="search-error" style={{ color: 'red' }}>
              Error: {error.message}
            </div>
          )}
          onResolved={(data) => {
            if (!data || !data.results) {
              return null;
            }
            return (
              <div data-testid="search-results">
                {data.results.map((item: any) => (
                  <div
                    key={item.id}
                    data-testid="search-result-item"
                    style={{
                      padding: '8px 12px',
                      borderBottom: '1px solid #eee',
                    }}
                  >
                    {item.name}
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
