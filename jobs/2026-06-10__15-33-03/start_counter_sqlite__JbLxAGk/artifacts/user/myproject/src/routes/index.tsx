import { createFileRoute } from '@tanstack/react-router'
import { getCounter, incrementCounter } from '../server/counter'

export const Route = createFileRoute('/')({
  component: Home,
  loader: async () => {
    const data = await getCounter()
    return { count: data.count }
  },
})

function Home() {
  const { count } = Route.useLoaderData()
  const [currentCount, setCurrentCount] = React.useState(count)
  const [isPending, setIsPending] = React.useState(false)

  const handleIncrement = async () => {
    setIsPending(true)
    try {
      const result = await incrementCounter()
      setCurrentCount(result.count)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Counter App</h1>
      <p data-testid="count" style={{ fontSize: '2rem', margin: '1rem 0' }}>
        Count: {currentCount}
      </p>
      <button onClick={handleIncrement} disabled={isPending} style={{ fontSize: '1rem', padding: '0.5rem 1rem' }}>
        {isPending ? 'Incrementing...' : 'Increment'}
      </button>
    </div>
  )
}

import React from 'react'