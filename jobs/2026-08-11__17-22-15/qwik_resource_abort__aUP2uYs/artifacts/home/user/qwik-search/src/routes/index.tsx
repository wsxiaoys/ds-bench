import { component$, useSignal, useVisibleTask$, useResource$, Resource } from '@builder.io/qwik';
import { useLocation } from '@builder.io/qwik-city';
import { isServer } from '@builder.io/qwik/build';

export default component$(() => {
  const inputSignal = useSignal('');
  const debouncedQuery = useSignal('');
  const loc = useLocation();

  useVisibleTask$(({ track, cleanup }) => {
    const value = track(() => inputSignal.value);
    const id = setTimeout(() => {
      debouncedQuery.value = value;
    }, 300);
    cleanup(() => clearTimeout(id));
  });

  const searchResource = useResource$(async ({ track, cleanup }) => {
    const query = track(() => debouncedQuery.value);
    const trimmed = query.trim();
    if (isServer || trimmed.length < 2) {
      return null;
    }

    const controller = new AbortController();
    cleanup(() => controller.abort());

    const origin = typeof window !== 'undefined' ? window.location.origin : loc.url.origin;
    const fetchUrl = `${origin}/api/search?q=${encodeURIComponent(trimmed)}`;

    const res = await fetch(fetchUrl, {
      signal: controller.signal,
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || 'Server error');
    }

    return res.json() as Promise<{
      query: string;
      count: number;
      results: Array<{ id: number; name: string }>;
    }>;
  });

  const showResource = debouncedQuery.value.trim().length >= 2;

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Qwik Search</h1>
      <input
        type="text"
        value={inputSignal.value}
        onInput$={(e) => {
          inputSignal.value = (e.target as HTMLInputElement).value;
        }}
        data-testid="search-input"
        placeholder="Type to search..."
        style={{ padding: '8px', fontSize: '16px', width: '300px' }}
      />

      <div style={{ marginTop: '20px' }}>
        {showResource && (
          <Resource
            value={searchResource}
            onPending={() => (
              <div data-testid="search-pending" style={{ color: 'gray' }}>
                Loading...
              </div>
            )}
            onResolved={(data) => {
              if (!data) return null;
              return (
                <div data-testid="search-results">
                  {data.results.map((item) => (
                    <div
                      key={item.id}
                      data-testid="search-result-item"
                      style={{ padding: '4px 0' }}
                    >
                      {item.name}
                    </div>
                  ))}
                </div>
              );
            }}
            onRejected={(err) => (
              <div data-testid="search-error" style={{ color: 'red' }}>
                {err.message}
              </div>
            )}
          />
        )}
      </div>
    </div>
  );
});
