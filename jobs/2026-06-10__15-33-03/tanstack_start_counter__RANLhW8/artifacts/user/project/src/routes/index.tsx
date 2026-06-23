import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

let count = 0

const getCount = createServerFn({ method: 'GET' }).handler(() => {
  return count
})

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
    <div>
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