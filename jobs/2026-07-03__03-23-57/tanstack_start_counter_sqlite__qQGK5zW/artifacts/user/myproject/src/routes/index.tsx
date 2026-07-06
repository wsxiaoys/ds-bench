import { createFileRoute } from '@tanstack/react-router'
import { getCounter, incrementCounter } from '../counter.functions'
import { useState } from 'react'
import { Plus, RotateCw } from 'lucide-react'

export const Route = createFileRoute('/')({
  loader: async () => {
    const count = await getCounter()
    return { count }
  },
  component: App,
})

function App() {
  const { count: initialCount } = Route.useLoaderData()
  const [count, setCount] = useState(initialCount)
  const [isUpdating, setIsUpdating] = useState(false)

  const handleIncrement = async () => {
    if (isUpdating) return
    setIsUpdating(true)
    try {
      const newCount = await incrementCounter()
      setCount(newCount)
    } catch (error) {
      console.error('Failed to increment:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <main className="page-wrap px-4 pb-8 pt-14 flex flex-col items-center justify-center min-h-[70vh]">
      <section className="island-shell rise-in relative overflow-hidden rounded-[2rem] px-8 py-12 sm:px-14 sm:py-16 max-w-md w-full text-center border border-[rgba(79,184,178,0.15)] shadow-xl bg-white/40 backdrop-blur-md">
        <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(79,184,178,0.25),transparent_66%)]" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(47,106,74,0.12),transparent_66%)]" />
        
        <p className="island-kicker mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--lagoon-deep)]">
          TanStack Start Counter
        </p>
        
        <h1 className="text-3xl font-bold tracking-tight text-[var(--sea-ink)] mb-6">
          SQLite Persisted Counter
        </h1>

        <div className="my-10 relative flex items-center justify-center">
          <div className="w-48 h-44 rounded-2xl bg-gradient-to-br from-[rgba(79,184,178,0.1)] to-[rgba(47,106,74,0.05)] border border-[rgba(79,184,178,0.2)] flex flex-col items-center justify-center shadow-inner relative group transition-all duration-300 hover:scale-105">
            <span className="text-6xl font-extrabold text-[var(--sea-ink)] tabular-nums transition-all duration-200">
              {count}
            </span>
            <span className="text-xs font-medium text-[var(--sea-ink-soft)] mt-2">
              CURRENT VALUE
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-4 items-center justify-center">
          <button
            onClick={handleIncrement}
            disabled={isUpdating}
            className="w-full flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[var(--lagoon-deep)] to-[rgba(50,143,151,0.9)] text-white px-6 py-4 text-base font-bold shadow-lg shadow-[rgba(79,184,178,0.3)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[rgba(79,184,178,0.4)] active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            {isUpdating ? (
              <RotateCw className="h-5 w-5 animate-spin" />
            ) : (
              <Plus className="h-5 w-5 stroke-[3]" />
            )}
            <span>Increment Count</span>
          </button>
          
          <p className="text-xs text-[var(--sea-ink-soft)] mt-2">
            Value is persisted in SQLite on disk. Try reloading or restarting the server!
          </p>
        </div>
      </section>

      <section className="island-shell mt-8 rounded-2xl p-6 max-w-md w-full text-sm">
        <h2 className="font-semibold text-[var(--sea-ink)] mb-2">Programmatic API</h2>
        <p className="text-[var(--sea-ink-soft)] mb-3 leading-relaxed">
          This backend also exposes standard JSON REST endpoints for external programmatic access:
        </p>
        <ul className="space-y-2 text-[var(--sea-ink-soft)] font-mono text-xs text-left bg-black/5 p-4 rounded-xl border border-black/5">
          <li className="flex justify-between items-center">
            <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">GET</span>
            <span>/api/counter</span>
          </li>
          <li className="flex justify-between items-center">
            <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">POST</span>
            <span>/api/counter/increment</span>
          </li>
        </ul>
      </section>
    </main>
  )
}
