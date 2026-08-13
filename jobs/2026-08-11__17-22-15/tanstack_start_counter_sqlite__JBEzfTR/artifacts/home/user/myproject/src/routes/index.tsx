import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { getCounterFn, incrementCounterFn } from '../serverFunctions'

export const Route = createFileRoute('/')({
  loader: async () => {
    return getCounterFn()
  },
  component: App,
})

function App() {
  const count = Route.useLoaderData()
  const router = useRouter()
  const [isIncrementing, setIsIncrementing] = useState(false)

  const handleIncrement = async () => {
    setIsIncrementing(true)
    try {
      await incrementCounterFn()
      await router.invalidate({ sync: true })
    } catch (error) {
      console.error('Failed to increment counter:', error)
    } finally {
      setIsIncrementing(false)
    }
  }

  return (
    <main className="page-wrap px-4 pb-12 pt-14">
      <section className="island-shell rise-in relative overflow-hidden rounded-[2rem] px-6 py-10 sm:px-10 sm:py-14 text-center">
        <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(79,184,178,0.32),transparent_66%)]" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(47,106,74,0.18),transparent_66%)]" />
        
        <p className="island-kicker mb-3">TanStack Start & SQLite</p>
        <h1 className="display-title mb-5 text-4xl leading-[1.02] font-bold tracking-tight text-[var(--sea-ink)] sm:text-6xl">
          Full-Stack Counter
        </h1>
        <p className="mb-8 max-w-2xl mx-auto text-base text-[var(--sea-ink-soft)] sm:text-lg">
          This counter value is rendered server-side from a local SQLite database, mutated via 
          TanStack Start Server Functions, and synchronized across client and backend.
        </p>

        {/* Counter Display & Control */}
        <div className="my-10 flex flex-col items-center justify-center gap-6">
          <div className="relative flex items-center justify-center w-40 h-40 rounded-full border-2 border-[var(--line)] bg-white/40 dark:bg-black/20 shadow-inner">
            <span className="text-6xl font-extrabold text-[var(--sea-ink)] tracking-tight">
              {count}
            </span>
          </div>
          
          <button
            onClick={handleIncrement}
            disabled={isIncrementing}
            className="rounded-full bg-[var(--lagoon-deep)] text-white font-bold px-8 py-4 text-lg shadow-lg hover:bg-[var(--lagoon)] hover:-translate-y-0.5 transition active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none"
          >
            {isIncrementing ? 'Incrementing...' : 'Increment Counter'}
          </button>
        </div>
      </section>

      {/* API Reference Section */}
      <section className="island-shell mt-8 rounded-2xl p-6 sm:p-8">
        <p className="island-kicker mb-4">REST JSON API Surface</p>
        <p className="mb-6 text-sm text-[var(--sea-ink-soft)]">
          The same persistent SQLite backend exposes programmatic REST endpoints. Other clients can read or mutate the counter value directly.
        </p>
        
        <div className="grid gap-6 md:grid-cols-2">
          <div className="demo-code-block flex flex-col justify-between">
            <div>
              <span className="inline-block bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider px-2 py-1 rounded mb-3">
                GET
              </span>
              <code className="block text-xs font-mono bg-black/5 dark:bg-white/5 p-2 rounded mb-3 overflow-x-auto">
                /api/counter
              </code>
              <p className="text-xs text-[var(--sea-ink-soft)] mb-4">
                Fetch the current counter value.
              </p>
            </div>
            <pre className="text-xs font-mono bg-black/10 dark:bg-white/5 p-3 rounded overflow-x-auto text-[var(--sea-ink)]">
{`{
  "count": ${count}
}`}
            </pre>
          </div>

          <div className="demo-code-block flex flex-col justify-between">
            <div>
              <span className="inline-block bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider px-2 py-1 rounded mb-3">
                POST
              </span>
              <code className="block text-xs font-mono bg-black/5 dark:bg-white/5 p-2 rounded mb-3 overflow-x-auto">
                /api/counter/increment
              </code>
              <p className="text-xs text-[var(--sea-ink-soft)] mb-4">
                Atomically increment the counter and return the new value.
              </p>
            </div>
            <pre className="text-xs font-mono bg-black/10 dark:bg-white/5 p-3 rounded overflow-x-auto text-[var(--sea-ink)]">
{`{
  "count": ${count + 1}
}`}
            </pre>
          </div>
        </div>
      </section>

      {/* Architecture details */}
      <section className="island-shell mt-8 rounded-2xl p-6">
        <p className="island-kicker mb-2">Technical Architecture</p>
        <ul className="m-0 list-disc space-y-2 pl-5 text-sm text-[var(--sea-ink-soft)]">
          <li>
            <strong>Server-Side Rendering (SSR):</strong> The initial HTML document loaded by the browser contains the current counter value rendered directly by the server.
          </li>
          <li>
            <strong>Server Functions:</strong> Mutating the value uses <code>createServerFn</code> under the hood to execute secure server-side SQL queries directly from the React component.
          </li>
          <li>
            <strong>SQLite Database:</strong> The counter state is persisted to a local disk file (<code>counter.db</code>) and survives server restarts.
          </li>
          <li>
            <strong>Single Source of Truth:</strong> The UI, Loader, and API endpoints all delegate to the same SQLite database queries and server function helper.
          </li>
        </ul>
      </section>
    </main>
  )
}
