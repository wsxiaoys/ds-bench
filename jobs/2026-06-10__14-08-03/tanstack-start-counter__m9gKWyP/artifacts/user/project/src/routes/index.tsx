import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useState } from 'react'

let serverCount = 0

const incrementFn = createServerFn({ method: 'POST' }).handler(async () => {
  serverCount += 1
  return serverCount
})

export const Route = createFileRoute('/')({
  component: App,
})

function App() {
  const [count, setCount] = useState(0)

  return (
    <main className="p-4">
      <h1>Counter App</h1>
      <p>Count: {count}</p>
      <button
        onClick={async () => {
          const newCount = await incrementFn()
          setCount(newCount)
        }}
      >
        Increment
      </button>
    </main>
  )
}
