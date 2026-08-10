import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useState, useEffect } from 'react'
import { getPoll, Poll } from '../db'

const getPollFn = createServerFn({ method: 'GET' })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    return await getPoll(id)
  })

export const Route = createFileRoute('/poll/$id')({
  loader: async ({ params }) => {
    const poll = await getPollFn({ data: params.id })
    if (!poll) {
      throw new Error('Poll not found')
    }
    return poll
  },
  component: PollComponent,
  errorComponent: () => (
    <div className="card">
      <h2>Poll Not Found</h2>
      <p>The poll you are looking for does not exist or has been deleted.</p>
      <a href="/" className="btn">Go Back Home</a>
    </div>
  ),
})

function PollComponent() {
  const initialPoll = Route.useLoaderData()
  const [poll, setPoll] = useState<Poll>(initialPoll)
  const [voteError, setVoteError] = useState<string | null>(null)
  const [votingId, setVotingId] = useState<string | null>(null)

  // Poll for updates every 1 second to implement live results
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/polls/${poll.id}`)
        if (res.ok) {
          const data = await res.json()
          setPoll(data)
        }
      } catch (err) {
        console.error('Failed to fetch updated poll', err)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [poll.id])

  const handleVote = async (optionId: string) => {
    setVoteError(null)
    setVotingId(optionId)

    try {
      const res = await fetch(`/api/polls/${poll.id}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ optionId }),
      })

      const data = await res.json()

      if (!res.ok) {
        setVoteError(data.error || 'Failed to cast vote')
        return
      }

      setPoll(data)
    } catch (err: any) {
      setVoteError(err.message || 'An error occurred while voting')
    } finally {
      setVotingId(null)
    }
  }

  return (
    <div className="card">
      <h2 style={{ marginBottom: '1.5rem' }}>{poll.question}</h2>

      {voteError && (
        <div data-testid="vote-error" className="error" style={{ marginBottom: '1.5rem' }}>
          {voteError}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
        {poll.options.map((option) => {
          const percent = poll.totalVotes === 0 ? 0 : Math.round((option.votes / poll.totalVotes) * 100)
          
          return (
            <div
              key={option.id}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
                padding: '1rem',
                backgroundColor: '#f9fafb',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Progress bar background */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: `${percent}%`,
                  backgroundColor: '#dbeafe',
                  zIndex: 1,
                  transition: 'width 0.5s ease-out-in'
                }}
              />

              <div
                style={{
                  position: 'relative',
                  zIndex: 2,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                  <button
                    data-testid={`vote-${option.id}`}
                    onClick={() => handleVote(option.id)}
                    disabled={votingId !== null}
                    className="btn"
                    style={{
                      padding: '0.375rem 0.75rem',
                      fontSize: '0.875rem'
                    }}
                  >
                    {votingId === option.id ? 'Voting...' : 'Vote'}
                  </button>
                  <span style={{ fontWeight: 500 }}>{option.text}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <span
                    data-testid={`count-${option.id}`}
                    style={{ fontWeight: 'bold', minWidth: '3rem', textAlign: 'right' }}
                  >
                    {option.votes}
                  </span>
                  <span
                    data-testid={`percent-${option.id}`}
                    style={{
                      fontWeight: 'bold',
                      color: '#2563eb',
                      minWidth: '3.5rem',
                      textAlign: 'right'
                    }}
                  >
                    {percent}%
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div
        style={{
          borderTop: '1px solid #e5e7eb',
          paddingTop: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: '#4b5563'
        }}
      >
        <span>
          Total Votes: <strong data-testid="total-votes">{poll.totalVotes}</strong>
        </span>
        <a href="/" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>
          ← Back to All Polls
        </a>
      </div>
    </div>
  )
}
