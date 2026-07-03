import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

// In-memory counter state on the server
let count = 0

// Server function to get the current count
const getCount = createServerFn({ method: 'GET' }).handler(() => {
  return count
})

// Server function to increment the counter and return the new value
const incrementCount = createServerFn({ method: 'POST' }).handler(() => {
  count += 1
  return count
})

export const Route = createFileRoute('/')({
  component: Home,
  loader: async () => await getCount(),
})

function Home() {
  const router = useRouter()
  const state = Route.useLoaderData()

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>Count: {state}</h1>
      <button
        type="button"
        onClick={() => {
          incrementCount().then(() => {
            router.invalidate()
          })
        }}
      >
        Increment
      </button>
    </div>
  )
}