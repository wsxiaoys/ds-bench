import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import * as React from 'react'
import { getPollsFn } from '../utils/db-server'

export const Route = createFileRoute('/')({
  loader: async () => {
    const polls = await getPollsFn()
    return { polls }
  },
  component: HomeComponent,
})

function HomeComponent() {
  const { polls } = Route.useLoaderData()
  const navigate = useNavigate()
  
  const [question, setQuestion] = React.useState('')
  const [options, setOptions] = React.useState(['', ''])
  const [error, setError] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

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
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/polls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question,
          options,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to create poll')
        setIsSubmitting(false)
        return
      }

      // Navigate to the newly created poll page
      navigate({ to: `/poll/${data.id}` })
    } catch (err: any) {
      setError(err.message || 'An error occurred')
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <h1 style={{ marginBottom: '2rem', textAlign: 'center' }}>Real-Time Polling App</h1>

      {/* Create Poll Form */}
      <section style={{ background: '#f9f9f9', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid #e2e8f0' }}>
        <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Create a New Poll</h2>
        {error && (
          <div style={{ color: '#e53e3e', background: '#fff5f5', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', border: '1px solid #fed7d7' }}>
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="question" style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Poll Question
            </label>
            <input
              id="question"
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What is your favorite programming language?"
              style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', borderRadius: '4px', border: '1px solid #cbd5e0', boxSizing: 'border-box' }}
              required
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Options (At least 2)
            </label>
            {options.map((option, index) => (
              <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  type="text"
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  style={{ flex: 1, padding: '0.75rem', fontSize: '1rem', borderRadius: '4px', border: '1px solid #cbd5e0', boxSizing: 'border-box' }}
                  required
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(index)}
                    style={{ padding: '0 1rem', background: '#e53e3e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem' }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addOption}
              style={{ marginTop: '0.5rem', padding: '0.5rem 1rem', background: '#3182ce', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              + Add Option
            </button>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', background: '#48bb78', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            {isSubmitting ? 'Creating...' : 'Create Poll'}
          </button>
        </form>
      </section>

      {/* Existing Polls List */}
      <section>
        <h2>Existing Polls</h2>
        {polls.length === 0 ? (
          <p style={{ color: '#718096', fontStyle: 'italic' }}>No polls created yet. Be the first to create one!</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {polls.map((poll) => (
              <Link
                key={poll.id}
                to={`/poll/${poll.id}`}
                style={{
                  display: 'block',
                  textDecoration: 'none',
                  color: 'inherit',
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  padding: '1.5rem',
                  borderRadius: '8px',
                  transition: 'box-shadow 0.2s, border-color 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = '#cbd5e0'
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0'
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'
                }}
              >
                <h3 style={{ margin: '0 0 0.5rem 0', color: '#2d3748' }}>{poll.question}</h3>
                <div style={{ color: '#718096', fontSize: '0.9rem' }}>
                  {poll.totalVotes} {poll.totalVotes === 1 ? 'vote' : 'votes'} • {poll.options.length} options
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
