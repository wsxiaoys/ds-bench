import { createFileRoute, useRouter } from '@tanstack/react-router'
import { getCounter, incrementCounter } from '#/server-functions/counter'

export const Route = createFileRoute('/')({
  component: App,
  loader: async () => {
    const count = await getCounter()
    return { count }
  },
})

function App() {
  const { count } = Route.useLoaderData()
  const router = useRouter()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-bold">Count: {count}</h1>
      <button
        type="button"
        className="rounded-lg bg-blue-600 px-6 py-3 text-lg font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer"
        onClick={async () => {
          await incrementCounter()
          router.invalidate()
        }}
      >
        Increment
      </button>
    </main>
  )
}
