import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { getCount, incrementCount } from '../server/counter'

export const Route = createFileRoute('/')({
  component: App,
  loader: async () => await getCount(),
})

function App() {
  const router = useRouter()
  const initialCount = Route.useLoaderData()
  const [count, setCount] = useState<number>(initialCount)

  return (
    <main className="page-wrap px-4 py-12">
      <section className="island-shell rounded-2xl p-6 sm:p-8">
        <p className="island-kicker mb-2">Counter</p>
        <h1 className="display-title mb-6 text-4xl font-bold text-[var(--sea-ink)] sm:text-5xl">
          Count: {count}
        </h1>
        <button
          type="button"
          className="rounded-full border border-[rgba(50,143,151,0.3)] bg-[rgba(79,184,178,0.14)] px-5 py-2.5 text-sm font-semibold text-[var(--lagoon-deep)] transition hover:-translate-y-0.5 hover:bg-[rgba(79,184,178,0.24)]"
          onClick={() => {
            incrementCount().then((next) => {
              setCount(next)
              router.invalidate()
            })
          }}
        >
          Increment
        </button>
      </section>
    </main>
  )
}