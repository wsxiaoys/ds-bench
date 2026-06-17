import { createFileRoute, useRouter } from '@tanstack/react-router'
import { getCountFn, incrementCountFn } from '../lib/counterFn'
import { useState } from 'react'

export const Route = createFileRoute('/')({
  loader: async () => {
    return await getCountFn()
  },
  component: App,
})

function App() {
  const { count } = Route.useLoaderData()
  const router = useRouter()
  const [isIncrementing, setIsIncrementing] = useState(false)

  const handleIncrement = async () => {
    setIsIncrementing(true)
    try {
      await incrementCountFn()
      await router.invalidate()
    } catch (err) {
      console.error('Failed to increment:', err)
    } finally {
      setIsIncrementing(false)
    }
  }

  return (
    <main className="page-wrap px-4 pb-8 pt-14 flex flex-col items-center justify-center min-h-[60vh]">
      <section className="island-shell rise-in relative overflow-hidden rounded-[2rem] px-6 py-10 sm:px-10 sm:py-14 text-center max-w-md w-full">
        <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(79,184,178,0.32),transparent_66%)]" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(47,106,74,0.18),transparent_66%)]" />
        
        <p className="island-kicker mb-3">TanStack Start & SQLite</p>
        <h1 className="display-title mb-5 text-4xl leading-[1.02] font-bold tracking-tight text-[var(--sea-ink)] sm:text-5xl">
          Full-Stack Counter
        </h1>
        
        <div className="my-8">
          <p className="text-sm uppercase tracking-wider text-[var(--sea-ink-soft)] mb-1">Current Count</p>
          <div className="text-6xl font-extrabold text-[var(--lagoon-deep)] select-none" id="counter-value">
            {count}
          </div>
        </div>

        <button
          onClick={handleIncrement}
          disabled={isIncrementing}
          className="w-full rounded-full border border-[rgba(50,143,151,0.3)] bg-[rgba(79,184,178,0.14)] px-6 py-3 text-lg font-semibold text-[var(--lagoon-deep)] transition hover:-translate-y-0.5 hover:bg-[rgba(79,184,178,0.24)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isIncrementing ? 'Incrementing...' : 'Increment'}
        </button>
      </section>
    </main>
  )
}
