import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useState, useEffect } from 'react'

// In-memory counter state on the server
let counterState = 0

const getCount = createServerFn({ method: 'GET' }).handler(async () => {
  return counterState
})

const incrementCount = createServerFn({ method: 'POST' }).handler(async () => {
  counterState++
  return counterState
})

export const Route = createFileRoute('/')({
  loader: async () => {
    const count = await getCount()
    return { count }
  },
  component: Home,
})

function Home() {
  const { count: loaderCount } = Route.useLoaderData()
  const router = useRouter()
  const [count, setCount] = useState(loaderCount)

  useEffect(() => {
    setCount(loaderCount)
  }, [loaderCount])

  const handleIncrement = async () => {
    const newCount = await incrementCount()
    setCount(newCount)
    router.invalidate()
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>TanStack Start Counter</h1>
      <p>Count: {count}</p>
      <button onClick={handleIncrement}>Increment</button>
    </div>
  )
}
