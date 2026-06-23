import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useState } from 'react'

let count = 0

const getCount = createServerFn({ method: 'GET' })
  .handler(async () => {
    return count
  })

const incrementCount = createServerFn({ method: 'POST' })
  .handler(async () => {
    count++
    return count
  })

export const Route = createFileRoute('/')({
  loader: async () => {
    return {
      initialCount: await getCount()
    }
  },
  component: CounterComponent,
})

function CounterComponent() {
  const { initialCount } = Route.useLoaderData()
  const [currentCount, setCurrentCount] = useState(initialCount)

  const handleIncrement = async () => {
    const newCount = await incrementCount()
    setCurrentCount(newCount)
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Counter App</h1>
      <p>Count: {currentCount}</p>
      <button onClick={handleIncrement}>Increment</button>
    </div>
  )
}
