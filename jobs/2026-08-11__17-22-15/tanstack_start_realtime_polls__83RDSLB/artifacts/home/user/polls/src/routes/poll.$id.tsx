import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { getPollFn } from '../server-fns'

export const Route = createFileRoute('/poll/$id')({
  loader: async ({ params }) => {
    const data = await getPollFn({ data: params.id })
    if (!data) {
      throw new Error('Poll not found')
    }
    return data
  },
  component: PollComponent,
  errorComponent: () => (
    <div>
      <h2>Poll Not Found</h2>
      <p>The poll you are looking for does not exist or has been deleted.</p>
      <Link to="/" style={{ color: '#007bff' }}>Go back to home page</Link>
    </div>
  )
})

function PollComponent() {
  const initialData = Route.useLoaderData()
  const { id } = Route.useParams()
  
  const [poll, setPoll] = useState(initialData.poll)
  const [hasVoted, setHasVoted] = useState(initialData.hasVoted)
  const [voteError, setVoteError] = useState<string | null>(null)

  // Sync state with loader data
  useEffect(() => {
    setPoll(initialData.poll)
    setHasVoted(initialData.hasVoted)
  }, [initialData])

  // Real-time polling updates every 2 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await getPollFn({ data: id })
        if (data && data.poll) {
          setPoll(data.poll)
          setHasVoted(data.hasVoted)
        }
      } catch (err) {
        console.error('Failed to fetch real-time poll updates:', err)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [id])

  const getPercent = (votes: number, total: number) => {
    if (total === 0) return 0
    return Math.round((votes / total) * 100)
  }

  const handleVote = async (optionId: string) => {
    setVoteError(null)
    
    if (hasVoted) {
      setVoteError('You have already voted on this poll')
      return
    }

    try {
      const res = await fetch(`/api/polls/${poll.id}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ optionId })
      })

      const data = await res.json()

      if (res.status === 200) {
        setPoll(data)
        setHasVoted(true)
      } else if (res.status === 409) {
        setVoteError(data.error || 'You have already voted on this poll')
        setHasVoted(true) // update state to match server
      } else {
        setVoteError(data.error || 'Failed to cast vote')
      }
    } catch (err: any) {
      setVoteError(err.message || 'Network error')
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <Link to="/" style={{ textDecoration: 'none', color: '#007bff' }}>&larr; Back to Polls</Link>
      </div>

      <h1>{poll.question}</h1>

      <div 
        data-testid="total-votes" 
        style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px', color: '#555' }}
      >
        Total Votes: {poll.totalVotes}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {poll.options.map((option) => {
          const percent = getPercent(option.votes, poll.totalVotes)
          return (
            <div 
              key={option.id} 
              style={{ 
                padding: '15px', 
                border: '1px solid #ccc', 
                borderRadius: '8px',
                background: '#f9f9f9',
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
                  background: 'rgba(40, 167, 69, 0.1)',
                  zIndex: 0,
                  transition: 'width 0.5s ease-in-out'
                }} 
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                <div>
                  <span style={{ fontSize: '18px', fontWeight: 'bold', marginRight: '15px' }}>
                    {option.text}
                  </span>
                  <span 
                    data-testid={`count-${option.id}`} 
                    style={{ background: '#eee', padding: '2px 8px', borderRadius: '12px', fontSize: '14px', color: '#666' }}
                  >
                    {option.votes}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <span 
                    data-testid={`percent-${option.id}`} 
                    style={{ fontSize: '18px', fontWeight: 'bold', color: '#28a745' }}
                  >
                    {percent}%
                  </span>

                  <button
                    data-testid={`vote-${option.id}`}
                    onClick={() => handleVote(option.id)}
                    disabled={hasVoted}
                    style={{ 
                      padding: '8px 16px', 
                      background: hasVoted ? '#ccc' : '#28a745', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '4px', 
                      cursor: hasVoted ? 'not-allowed' : 'pointer',
                      fontWeight: 'bold'
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

      {voteError && (
        <div 
          data-testid="vote-error" 
          style={{ 
            marginTop: '20px', 
            padding: '15px', 
            background: '#f8d7da', 
            color: '#721c24', 
            border: '1px solid #f5c6cb', 
            borderRadius: '4px',
            fontWeight: 'bold'
          }}
        >
          {voteError}
        </div>
      )}
    </div>
  )
}
