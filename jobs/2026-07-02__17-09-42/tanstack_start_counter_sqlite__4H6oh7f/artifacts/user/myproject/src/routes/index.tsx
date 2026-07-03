import { createFileRoute } from '@tanstack/react-router'
import { getCounter, incrementCounter } from '#/server/counter'

/**
 * The root page. The counter value is fetched on the server during SSR via
 * the TanStack Router loader, so the initial HTML response already contains
 * the current number - no client-only fetch is needed.
 */
export const Route = createFileRoute('/')({
  loader: async () => {
    const { count } = await getCounter()
    return { count }
  },
  component: Home,
})

function Home() {
  const { count } = Route.useLoaderData()

  return (
    <div
      style={{
        padding: 32,
        fontFamily: 'system-ui, sans-serif',
        maxWidth: 640,
        margin: '0 REDACTED',
      }}
    >
      <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>
        TanStack Start Counter
      </h1>
      <p style={{ marginTop: 16, color: '#555' }}>
        Current counter value (persisted in SQLite on disk):
      </p>
      <div
        data-testid="counter-value"
        style={{
          fontSize: '4rem',
          fontWeight: 700,
          marginTop: 8,
          padding: '12px 24px',
          border: '1px solid #ddd',
          borderRadius: 12,
          display: 'inline-block',
          background: '#fafafa',
        }}
      >
        {count}
      </div>
      <div style={{ marginTop: 24, display: 'flex', gap: 8 }}>
        <form method="post" action="/api/counter/increment">
          <button
            type="submit"
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid #111',
              background: '#111',
              color: '#fff',
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            +1 via REST
          </button>
        </form>
        <button
          type="button"
          onClick={async () => {
            await incrementCounter()
            window.location.reload()
          }}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: '1px solid #111',
            background: '#fff',
            color: '#111',
            fontSize: '1rem',
            cursor: 'pointer',
          }}
        >
          +1 via server fn
        </button>
      </div>
      <p style={{ marginTop: 32, fontSize: '0.85rem', color: '#777' }}>
        REST: <code>GET /api/counter</code>,{' '}
        <code>POST /api/counter/increment</code>
      </p>
    </div>
  )
}
