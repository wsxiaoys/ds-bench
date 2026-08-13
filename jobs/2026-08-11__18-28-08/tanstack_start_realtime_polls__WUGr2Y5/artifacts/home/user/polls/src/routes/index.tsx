import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { listAllPolls } from '../db'

// Server function to list all polls
const listPollsFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    return listAllPolls()
  })

export const Route = createFileRoute('/')({
  loader: async () => {
    const polls = await listPollsFn()
    return { polls }
  },
  component: HomeComponent,
})

function HomeComponent() {
  const { polls: initialPolls } = Route.useLoaderData()
  const [polls, setPolls] = useState(initialPolls)
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<string[]>(['', ''])
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const navigate = useNavigate()

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

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedQuestion = question.trim()
    const trimmedOptions = options.map((opt) => opt.trim()).filter(Boolean)

    if (!trimmedQuestion) {
      setError('Poll question is required.')
      return
    }

    if (trimmedOptions.length < 2) {
      setError('At least two non-empty options are required.')
      return
    }

    setIsCreating(true)

    try {
      const res = await fetch('/api/polls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: trimmedQuestion,
          options: trimmedOptions,
        }),
      })

      if (res.ok) {
        const newPoll = await res.json()
        // Clear form
        setQuestion('')
        setOptions(['', ''])
        // Redirect to the poll page
        navigate({ to: '/poll/$id', params: { id: newPoll.id } })
      } else {
        const errData = await res.json().catch(() => ({}))
        setError(errData.error || 'Failed to create poll.')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <main className="page-wrap px-4 pb-8 pt-14 max-w-4xl mx-auto grid gap-8 md:grid-cols-2">
      {/* Create Poll Section */}
      <section className="island-shell rise-in rounded-[2rem] p-6 sm:p-8">
        <h2 className="text-2xl font-bold text-[var(--sea-ink)] mb-4">
          Create a New Poll
        </h2>

        {error && (
          <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleCreatePoll} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[var(--sea-ink)] mb-1">
              Question
            </label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What would you like to ask?"
              className="w-full px-4 py-3 rounded-xl border border-[rgba(23,58,64,0.15)] focus:outline-none focus:ring-2 focus:ring-[var(--lagoon-deep)] focus:border-transparent bg-white/70"
              disabled={isCreating}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-[var(--sea-ink)] mb-1">
              Options
            </label>
            {options.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  className="flex-1 px-4 py-3 rounded-xl border border-[rgba(23,58,64,0.15)] focus:outline-none focus:ring-2 focus:ring-[var(--lagoon-deep)] focus:border-transparent bg-white/70"
                  disabled={isCreating}
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOptionField(index)}
                    className="p-3 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition"
                    disabled={isCreating}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-2">
            <button
              type="button"
              onClick={addOptionField}
              className="text-sm font-semibold text-[var(--lagoon-deep)] hover:underline"
              disabled={isCreating}
            >
              + Add Option
            </button>

            <button
              type="submit"
              className="rounded-full bg-[var(--lagoon-deep)] hover:bg-[var(--sea-ink)] text-white px-6 py-2.5 text-sm font-semibold transition disabled:opacity-50"
              disabled={isCreating}
            >
              {isCreating ? 'Creating...' : 'Create Poll'}
            </button>
          </div>
        </form>
      </section>

      {/* Polls List Section */}
      <section className="island-shell rise-in rounded-[2rem] p-6 sm:p-8">
        <h2 className="text-2xl font-bold text-[var(--sea-ink)] mb-4">
          Active Polls
        </h2>

        {polls.length === 0 ? (
          <div className="text-center py-10 text-[var(--sea-ink-soft)] bg-white/30 rounded-2xl border border-dashed border-[rgba(23,58,64,0.1)]">
            <p className="text-base font-medium">No polls available yet.</p>
            <p className="text-sm mt-1">Be the first to create one!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {polls.map((poll) => (
              <a
                key={poll.id}
                href={`/poll/${poll.id}`}
                className="block p-5 rounded-2xl border border-[rgba(23,58,64,0.1)] bg-white/50 hover:bg-white hover:border-[rgba(79,184,178,0.4)] hover:shadow-sm transition-all duration-200 no-underline group"
              >
                <h3 className="font-semibold text-lg text-[var(--sea-ink)] group-hover:text-[var(--lagoon-deep)] transition">
                  {poll.question}
                </h3>
                <div className="mt-2 flex justify-between items-center text-xs text-[var(--sea-ink-soft)]">
                  <span>
                    {poll.totalVotes} {poll.totalVotes === 1 ? 'vote' : 'votes'}
                  </span>
                  <span className="font-medium text-[var(--lagoon-deep)] group-hover:underline">
                    View & Vote →
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
