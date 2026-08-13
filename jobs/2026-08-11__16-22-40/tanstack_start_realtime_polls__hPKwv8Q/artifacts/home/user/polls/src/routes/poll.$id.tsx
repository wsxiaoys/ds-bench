import { createFileRoute, Link } from '@tanstack/react-router'
import * as React from 'react'
import { getPollFn } from '../utils/db-server'

export const Route = createFileRoute('/poll/$id')({
  loader: async ({ params }) => {
    const poll = await getPollFn(params.id)
    return { initialPoll: poll, pollId: params.id }
  },
  component: PollComponent,
})

function PollComponent() {
  const { initialPoll, pollId } = Route.useLoaderData()
  const [poll, setPoll] = React.useState(initialPoll)
  const [voteError, setVoteError] = React.useState<string | null>(null)
  const [isVoting, setIsSubmitting] = React.useState(false)

  // Polling for live updates
  React.useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/polls/${pollId}`)
        if (response.ok) {
          const updatedPoll = await response.json()
          setPoll(updatedPoll)
        }
      } catch (err) {
        console.error('Failed to fetch live updates', err)
      }
    }, 1500) // Poll every 1.5 seconds

    return () => clearInterval(interval)
  }, [pollId])

  if (!poll) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <h1 style={{ color: '#e53e3e' }}>Poll Not Found</h1>
        <p style={{ color: '#718096', marginBottom: '2rem' }}>The poll you are looking for does not exist or has been deleted.</p>
        <Link
          to="/"
          style={{
            padding: '0.75rem 1.5rem',
            background: '#3182ce',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '4px',
            fontWeight: 'bold'
          }}
        >
          Go Back Home
        </Link>
      </div>
    )
  }

  const handleVote = async (optionId: string) => {
    setVoteError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/polls/${pollId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ optionId }),
      })

      const data = await response.json()

      if (!response.ok) {
        setVoteError(data.error || 'Failed to cast vote')
        setIsSubmitting(false)
        return
      }

      // Vote succeeded, update local state immediately
      setPoll(data)
    } catch (err: any) {
      setVoteError(err.message || 'An error occurred while voting')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/" style={{ color: '#3182ce', textDecoration: 'none', fontWeight: 'bold' }}>
          ← Back to All Polls
        </Link>
      </div>

      <div style={{ background: 'white', border: '1px solid #e2e8f0', padding: '2rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h1 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#2d3748', fontSize: '1.8rem' }}>
          {poll.question}
        </h1>

        {/* Vote Error Message */}
        {voteError && (
          <div
            data-testid="vote-error"
            style={{
              color: '#e53e3e',
              background: '#fff5f5',
              padding: '1rem',
              borderRadius: '6px',
              marginBottom: '1.5rem',
              border: '1px solid #fed7d7',
              fontWeight: 'bold'
            }}
          >
            {voteError}
          </div>
        )}

        {/* Total Votes */}
        <div style={{ marginBottom: '2rem', color: '#4a5568', fontSize: '1.1rem', fontWeight: 'bold' }}>
          Total Votes:{' '}
          <span data-testid="total-votes" style={{ fontSize: '1.25rem', color: '#2d3748' }}>
            {poll.totalVotes}
          </span>
        </div>

        {/* Options List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {poll.options.map((option) => {
            const percentage = poll.totalVotes === 0 ? 0 : Math.round((option.votes / poll.totalVotes) * 100)

            return (
              <div
                key={option.id}
                style={{
                  border: '1px solid #edf2f7',
                  borderRadius: '8px',
                  padding: '1rem 1.5rem',
                  background: '#f7fafc',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Visual Progress Bar Background */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: `${percentage}%`,
                    background: '#ebf8ff',
                    zIndex: 0,
                    transition: 'width 0.5s ease-out'
                  }}
                />

                <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ fontWeight: '600', fontSize: '1.1rem', color: '#2d3748', marginBottom: '0.25rem' }}>
                      {option.text}
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#718096' }}>
                      <span data-testid={`count-${option.id}`} style={{ fontWeight: 'bold', color: '#4a5568' }}>
                        {option.votes}
                      </span>{' '}
                      {option.votes === 1 ? 'vote' : 'votes'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    {/* Percentage Display */}
                    <span
                      data-testid={`percent-${option.id}`}
                      style={{
                        fontSize: '1.5rem',
                        fontWeight: 'bold',
                        color: '#2b6cb0',
                        minWidth: '70px',
                        textAlign: 'right'
                      }}
                    >
                      {percentage}%
                    </span>

                    {/* Vote Button */}
                    <button
                      data-testid={`vote-${option.id}`}
                      onClick={() => handleVote(option.id)}
                      disabled={isVoting}
                      style={{
                        padding: '0.6rem 1.2rem',
                        fontSize: '1rem',
                        background: '#3182ce',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: isVoting ? 'not-allowed' : 'pointer',
                        fontWeight: 'bold',
                        transition: 'background-color 0.2s',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                      }}
                      onMouseOver={(e) => {
                        if (!isVoting) e.currentTarget.style.background = '#2b6cb0'
                      }}
                      onMouseOut={(e) => {
                        if (!isVoting) e.currentTarget.style.background = '#3182ce'
                      }}
                    >
                      Vote
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
