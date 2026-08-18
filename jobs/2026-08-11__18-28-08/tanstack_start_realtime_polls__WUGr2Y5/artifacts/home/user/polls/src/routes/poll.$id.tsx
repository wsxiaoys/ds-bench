import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useState, useEffect } from 'react'
import { getPoll } from '../db'

// Server function to get the poll
const getPollFn = createServerFn({ method: 'GET' })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const poll = getPoll(id)
    if (!poll) {
      throw new Error('NOT_FOUND')
    }
    return poll
  })

export const Route = createFileRoute('/poll/$id')({
  loader: async ({ params }) => {
    try {
      const poll = await getPollFn({ data: params.id })
      return { poll }
    } catch (err: any) {
      throw new Error('Poll not found')
    }
  },
  component: PollComponent,
})

function PollComponent() {
  const { poll: initialPoll } = Route.useLoaderData()
  const [poll, setPoll] = useState(initialPoll)
  const [voteError, setVoteError] = useState<string | null>(null)
  const [isVoting, setIsVoting] = useState(false)

  // Polling for live updates
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/polls/${poll.id}`)
        if (res.ok) {
          const updatedPoll = await res.json()
          setPoll(updatedPoll)
        }
      } catch (err) {
        console.error('Error polling poll data:', err)
      }
    }, 1000) // Poll every 1 second

    return () => clearInterval(interval)
  }, [poll.id])

  const handleVote = async (optionId: string) => {
    if (isVoting) return
    setIsVoting(true)
    setVoteError(null)

    try {
      const res = await fetch(`/api/polls/${poll.id}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ optionId }),
      })

      if (res.ok) {
        const updatedPoll = await res.json()
        setPoll(updatedPoll)
      } else {
        const errData = await res.json().catch(() => ({}))
        setVoteError(errData.error || 'Failed to cast vote')
      }
    } catch (err) {
      setVoteError('Network error. Please try again.')
    } finally {
      setIsVoting(false)
    }
  }

  return (
    <main className="page-wrap px-4 pb-8 pt-14 max-w-2xl mx-auto">
      <div className="island-shell rise-in rounded-[2rem] p-6 sm:p-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--sea-ink)] mb-2">
          {poll.question}
        </h1>
        
        <div className="mb-6 text-sm text-[var(--sea-ink-soft)]">
          Total Votes:{' '}
          <span className="font-semibold text-[var(--sea-ink)]" data-testid="total-votes">
            {poll.totalVotes}
          </span>
        </div>

        {voteError && (
          <div
            data-testid="vote-error"
            className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium"
          >
            {voteError}
          </div>
        )}

        <div className="space-y-4">
          {poll.options.map((option) => {
            const percent =
              poll.totalVotes === 0
                ? 0
                : Math.round((option.votes / poll.totalVotes) * 100)

            return (
              <div key={option.id} className="relative">
                <button
                  data-testid={`vote-${option.id}`}
                  onClick={() => handleVote(option.id)}
                  disabled={isVoting}
                  className="w-full text-left p-5 rounded-2xl border border-[rgba(23,58,64,0.15)] hover:border-[rgba(79,184,178,0.5)] hover:bg-[rgba(79,184,178,0.04)] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--lagoon-deep)] disabled:opacity-60 relative overflow-hidden group"
                >
                  {/* Background progress bar */}
                  <div
                    className="absolute top-0 left-0 bottom-0 bg-[rgba(79,184,178,0.08)] transition-all duration-500 ease-out pointer-events-none"
                    style={{ width: `${percent}%` }}
                  />

                  <div className="relative flex justify-between items-center z-10">
                    <span className="font-semibold text-[var(--sea-ink)] pr-4">
                      {option.text}
                    </span>
                    <div className="flex items-center space-x-4 shrink-0">
                      <span
                        data-testid={`count-${option.id}`}
                        className="text-sm font-medium text-[var(--sea-ink-soft)]"
                      >
                        {option.votes} {option.votes === 1 ? 'vote' : 'votes'}
                      </span>
                      <span
                        data-testid={`percent-${option.id}`}
                        className="text-base font-bold text-[var(--lagoon-deep)]"
                      >
                        {percent}%
                      </span>
                    </div>
                  </div>
                </button>
              </div>
            )
          })}
        </div>

        <div className="mt-8 pt-6 border-t border-[rgba(23,58,64,0.1)] flex justify-between items-center">
          <a
            href="/"
            className="text-sm font-medium text-[var(--lagoon-deep)] hover:underline flex items-center"
          >
            ← Back to Polls
          </a>
        </div>
      </div>
    </main>
  )
}
