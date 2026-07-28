import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { listPolls } from '../db'

const getPollsFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    return await listPolls()
  })

export const Route = createFileRoute('/')({
  loader: async () => {
    return await getPollsFn()
  },
  component: HomeComponent,
})

function HomeComponent() {
  const polls = Route.useLoaderData()
  const navigate = useNavigate()
  
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<string[]>(['', ''])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
  }

  const addOption = () => {
    setOptions([...options, ''])
  }

  const removeOption = (index: number) => {
    if (options.length <= 2) return
    const newOptions = options.filter((_, i) => i !== index)
    setOptions(newOptions)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/polls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question,
          options: options.filter(opt => opt.trim() !== ''),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to create poll')
        setLoading(false)
        return
      }

      // Redirect to the newly created poll page
      navigate({ to: '/poll/$id', params: { id: data.id } })
    } catch (err: any) {
      setError(err.message || 'An error occurred')
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="card">
        <h2>Create a New Poll</h2>
        {error && <div className="error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Question:
            </label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What is your favorite programming language?"
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '0.375rem',
                border: '1px solid #d1d5db',
                boxSizing: 'border-box'
              }}
              required
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Options:
            </label>
            {options.map((option, index) => (
              <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  type="text"
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #d1d5db',
                    boxSizing: 'border-box'
                  }}
                  required={index < 2}
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(index)}
                    className="btn btn-secondary"
                    style={{ padding: '0.5rem' }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addOption}
              className="btn btn-secondary"
              style={{ marginTop: '0.5rem' }}
            >
              + Add Option
            </button>
          </div>

          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'Creating...' : 'Create Poll'}
          </button>
        </form>
      </div>

      <div className="card">
        <h2>Active Polls</h2>
        {polls.length === 0 ? (
          <p style={{ color: '#6b7280' }}>No active polls yet. Create one above!</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {polls.map((poll) => (
              <li
                key={poll.id}
                style={{
                  padding: '1rem 0',
                  borderBottom: '1px solid #e5e7eb',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <h3 style={{ margin: '0 0 0.25rem 0' }}>
                    <Link
                      to="/poll/$id"
                      params={{ id: poll.id }}
                      style={{ color: '#2563eb', textDecoration: 'none' }}
                    >
                      {poll.question}
                    </Link>
                  </h3>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    {poll.totalVotes} {poll.totalVotes === 1 ? 'vote' : 'votes'}
                  </span>
                </div>
                <Link
                  to="/poll/$id"
                  params={{ id: poll.id }}
                  className="btn btn-secondary"
                  style={{ textDecoration: 'none' }}
                >
                  View Poll
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
