import {
  component$,
  useSignal,
  useTask$,
  useResource$,
  Resource,
} from '@builder.io/qwik';

interface SearchResultItem {
  id: number;
  name: string;
}

interface SearchResponse {
  query: string;
  count: number;
  results: SearchResultItem[];
}

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

export default component$(() => {
  const inputValue = useSignal('');
  const debouncedQuery = useSignal('');

  // Debounce: only propagate the input value to `debouncedQuery` after
  // typing has paused for 300ms.
  useTask$(({ track, cleanup }) => {
    const value = track(() => inputValue.value);

    const timer = setTimeout(() => {
      debouncedQuery.value = value;
    }, DEBOUNCE_MS);

    cleanup(() => clearTimeout(timer));
  });

  // Race-safe resource: every time `debouncedQuery` changes, any previous
  // in-flight request is aborted via the AbortController registered with
  // `cleanup`, so a late response for a stale query can never overwrite the
  // results of the newest query.
  const searchResource = useResource$<SearchResponse>(async ({ track, cleanup }) => {
    const query = track(() => debouncedQuery.value);
    const trimmed = query.trim();

    if (trimmed.length < MIN_QUERY_LENGTH) {
      return { query: trimmed, count: 0, results: [] };
    }

    const controller = new AbortController();
    cleanup(() => controller.abort());

    const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`search request failed with status ${res.status}`);
    }

    return (await res.json()) as SearchResponse;
  });

  const isIdle = debouncedQuery.value.trim().length < MIN_QUERY_LENGTH;

  return (
    <div>
      <h1>Search</h1>
      <input
        data-testid="search-input"
        type="text"
        value={inputValue.value}
        onInput$={(_, el) => {
          inputValue.value = el.value;
        }}
        placeholder="Search programming languages..."
      />

      {!isIdle && (
        <Resource
          value={searchResource}
          onPending={() => <div data-testid="search-pending">Searching...</div>}
          onRejected={() => <div data-testid="search-error">Something went wrong. Please try again.</div>}
          onResolved={(data) => (
            <div data-testid="search-results">
              {data.results.map((item) => (
                <div data-testid="search-result-item" key={item.id}>
                  {item.name}
                </div>
              ))}
            </div>
          )}
        />
      )}
    </div>
  );
});
