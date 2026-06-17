import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { getCounterFn, incrementCounterFn } from '../counter.functions'

export const Route = createFileRoute('/')({
  loader: () => getCounterFn(),
  component: HomePage,
})

function HomePage() {
  const data = Route.useLoaderData()
  const increment = useServerFn(incrementCounterFn)

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: '400px', margin: '80px auto', textAlign: 'center' }}>
      <h1>Counter</h1>
      <p style={{ fontSize: '4rem', fontWeight: 'bold' }} data-testid="count">{data.count}</p>
      <button
        style={{ padding: '12px 24px', fontSize: '1.2rem', cursor: 'pointer' }}
        onClick={async () => {
          await increment()
          window.location.reload()
        }}
      >
        Increment
      </button>
    </div>
  )
}
