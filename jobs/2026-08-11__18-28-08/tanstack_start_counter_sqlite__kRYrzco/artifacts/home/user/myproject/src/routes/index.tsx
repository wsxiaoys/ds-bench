import { createFileRoute, useRouter } from '@tanstack/react-router'
import { getCountFn, incrementCountFn } from '../functions/counter'

export const Route = createFileRoute('/')({
  loader: async () => {
    return await getCountFn()
  },
  component: Home,
})

function Home() {
  const { count } = Route.useLoaderData()
  const router = useRouter()

  const handleIncrement = async () => {
    try {
      await incrementCountFn()
      await router.invalidate()
    } catch (error) {
      console.error('Failed to increment:', error)
    }
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <h1>TanStack Start SQLite Counter</h1>
      <div style={{ fontSize: '3rem', margin: '2rem 0', fontWeight: 'bold' }}>
        Count: <span id="counter-value">{count}</span>
      </div>
      <button
        onClick={handleIncrement}
        style={{
          fontSize: '1.5rem',
          padding: '0.5rem 1.5rem',
          cursor: 'pointer',
          borderRadius: '4px',
          border: '1px solid #ccc',
          backgroundColor: '#0070f3',
          color: 'white',
        }}
      >
        Increment
      </button>
    </main>
  )
}
