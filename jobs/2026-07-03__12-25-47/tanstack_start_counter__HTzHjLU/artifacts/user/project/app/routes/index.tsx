import { createFileRoute } from '@tanstack/react-router'
import { createServerFn, useServerFn } from '@tanstack/react-start'
import { useState } from 'react'

// In-memory counter state on the server
let counter = 0

const getCount = createServerFn({ method: 'GET' }).handler(async () => {
  return counter
})

const incrementCounter = createServerFn({ method: 'POST' }).handler(async () => {
  counter += 1
  return counter
})

export const Route = createFileRoute('/')({
  loader: async () => await getCount(),
  component: HomePage,
})

function HomePage() {
  const initialCount = Route.useLoaderData()
  const [count, setCount] = useState<number>(initialCount)
  const increment = useServerFn(incrementCounter)

  return (
    <div>
      <p>Count: {count}</p>
      <button
        onClick={async () => {
          const newCount = await increment()
          setCount(newCount)
        }}
      >
        Increment
      </button>
    </div>
  )
}
