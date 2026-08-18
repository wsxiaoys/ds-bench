import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { getPollsFn, createPollFn } from '../server-fns'

export const Route = createFileRoute('/')({
  loader: async () => {
    return await getPollsFn()
  },
  component: HomeComponent,
})

function HomeComponent() {
  const polls = Route.useLoaderData()
  const router = useRouter()
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [error, setError] = useState<string | null>(null)

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
  }

  const addOptionField = () => {
    setOptions([...options, ''])
  }

  const removeOptionField = (index: number) => {
    if (options.length <= 2) return
    const newOptions = options.filter((_, i) => i !== index)
    setOptions(newOptions)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedQuestion = question.trim()
    const trimmedOptions = options.map(o => o.trim()).filter(o => o !== '')

    if (!trimmedQuestion) {
      setError('Question is required')
      return
    }

    if (trimmedOptions.length < 2) {
      setError('At least 2 non-empty options are required')
      return
    }

    try {
      const newPoll = await createPollFn({
        data: {
          question: trimmedQuestion,
          options: trimmedOptions,
        }
      })
      
      // Clear form
      setQuestion('')
      setOptions(['', ''])
      
      // Refresh list and navigate
      await router.invalidate()
      window.location.href = `/poll/${newPoll.id}`
    } catch (err: any) {
      setError(err.message || 'Failed to create poll')
    }
  }

  return (
    <div>
      <h1>Real-Time Polling App</h1>
      
      <div style={{ marginBottom: '40px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h2>Create a New Poll</h2>
        {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Question:</label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What is your favorite programming language?"
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
              required
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Options:</label>
            {options.map((option, index) => (
              <div key={index} style={{ display: 'flex', marginBottom: '10px' }}>
                <input
                  type="text"
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  style={{ flex: 1, padding: '8px' }}
                  required={index < 2}
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOptionField(index)}
                    style={{ marginLeft: '10px', padding: '8px 12px', background: '#ff4d4d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addOptionField}
              style={{ padding: '8px 12px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              + Add Option
            </button>
          </div>

          <button
            type="submit"
            style={{ padding: '10px 20px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}
          >
            Create Poll
          </button>
        </form>
      </div>

      <h2>Existing Polls</h2>
      {polls.length === 0 ? (
        <p>No polls created yet. Be the first to create one!</p>
      ) : (
        <ul style={{ listStyleType: 'none', padding: 0 }}>
          {polls.map((poll) => (
            <li key={poll.id} style={{ padding: '15px', border: '1px solid #eee', marginBottom: '10px', borderRadius: '4px' }}>
              <Link to={`/poll/${poll.id}`} style={{ textDecoration: 'none', color: '#007bff', fontSize: '18px', fontWeight: 'bold' }}>
                {poll.question}
              </Link>
              <div style={{ color: '#666', marginTop: '5px' }}>
                Total Votes: {poll.totalVotes}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
