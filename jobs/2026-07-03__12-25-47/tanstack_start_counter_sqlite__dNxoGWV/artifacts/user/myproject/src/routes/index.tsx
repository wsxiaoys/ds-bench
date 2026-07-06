import { createFileRoute } from '@tanstack/react-router'
import { getCounter, incrementCounter } from '../server/counter'

export const Route = createFileRoute('/')({
  loader: async () => {
    const data = await getCounter()
    return { count: data.count }
  },
  component: Home,
})

function Home() {
  const { count } = Route.useLoaderData()
  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold">Counter</h1>
      <p className="mt-4 text-lg" data-testid="counter-value">
        Current count: <strong>{count}</strong>
      </p>
      <form
        method="post"
        action="/api/counter/increment"
        className="mt-4"
        onSubmit={async (e) => {
          e.preventDefault()
          const data = await incrementCounter()
          window.location.reload()
        }}
      >
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Increment
        </button>
      </form>
    </div>
  )
}
