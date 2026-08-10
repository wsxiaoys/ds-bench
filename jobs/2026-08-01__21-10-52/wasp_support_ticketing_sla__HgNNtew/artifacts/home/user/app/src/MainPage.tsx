import { useState } from 'react'
import { useQuery, getTickets, getAgents, createTicket, simulateSlaBreach, resolveTicket } from 'wasp/client/operations'
import { logout } from 'wasp/client/auth'
import type { AuthUser } from 'wasp/auth'

export function MainPage({ user }: { user: AuthUser }) {
  const { data: tickets, error: ticketsError, isLoading: ticketsLoading } = useQuery(getTickets)
  const { data: agents, error: agentsError, isLoading: agentsLoading } = useQuery(getAgents)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('LOW')
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!title.trim() || !description.trim()) {
      setFormError('Title and description are required')
      return
    }

    setIsSubmitting(true)
    try {
      await createTicket({ title, description, priority })
      setTitle('')
      setDescription('')
      setPriority('LOW')
    } catch (err: any) {
      setFormError(err.message || 'Failed to create ticket')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSimulateBreach = async (ticketId: number) => {
    try {
      await simulateSlaBreach({ ticketId })
    } catch (err: any) {
      alert(err.message || 'Failed to simulate SLA breach')
    }
  }

  const handleResolve = async (ticketId: number) => {
    try {
      await resolveTicket({ ticketId })
    } catch (err: any) {
      alert(err.message || 'Failed to resolve ticket')
    }
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif', color: '#333' }}>
      {/* Header Section */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '20px', marginBottom: '30px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', color: '#1a73e8' }}>Customer Support Ticket System</h1>
          <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#666' }}>
            Logged in as: <strong>{user.username}</strong> ({user.role})
          </p>
        </div>
        <button 
          onClick={logout}
          style={{ padding: '8px 16px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Logout
        </button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '30px' }}>
        {/* Left Column: Create Ticket & Agents Workload */}
        <div>
          {/* Create Ticket Form */}
          <section style={{ backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '8px', border: '1px solid #e0e0e0', marginBottom: '30px' }}>
            <h2 style={{ marginTop: 0, fontSize: '18px', marginBottom: '15px' }}>Create New Ticket</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {formError && <div style={{ color: 'red', fontSize: '14px' }}>{formError}</div>}
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label htmlFor="ticket-title" style={{ fontWeight: 'bold', fontSize: '14px' }}>Title</label>
                <input 
                  type="text" 
                  id="ticket-title" 
                  data-testid="ticket-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px' }}
                  placeholder="Enter ticket title"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label htmlFor="ticket-desc" style={{ fontWeight: 'bold', fontSize: '14px' }}>Description</label>
                <textarea 
                  id="ticket-desc" 
                  data-testid="ticket-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px', minHeight: '80px', resize: 'vertical' }}
                  placeholder="Enter ticket description"
                ></textarea>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label htmlFor="ticket-priority" style={{ fontWeight: 'bold', fontSize: '14px' }}>Priority</label>
                <select 
                  id="ticket-priority" 
                  data-testid="ticket-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px' }}
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                </select>
              </div>

              <button 
                type="submit" 
                id="submit-ticket" 
                data-testid="submit-ticket"
                disabled={isSubmitting}
                style={{ padding: '10px', backgroundColor: '#1a73e8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
              </button>
            </form>
          </section>

          {/* Agents Workload */}
          <section style={{ backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
            <h2 style={{ marginTop: 0, fontSize: '18px', marginBottom: '15px' }}>Agent Workloads</h2>
            {agentsLoading ? (
              <div>Loading agents...</div>
            ) : agentsError ? (
              <div style={{ color: 'red' }}>Error loading agents</div>
            ) : agents && agents.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {agents.map((agent: any) => (
                  <li key={agent.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #eee' }}>
                    <span style={{ fontWeight: 'bold' }}>{agent.username}</span>
                    <span 
                      data-testid={`agent-workload-${agent.username}`}
                      style={{ backgroundColor: '#e8f0fe', color: '#1a73e8', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}
                    >
                      {agent.workload}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ color: '#666', fontSize: '14px' }}>No agents in the system</div>
            )}
          </section>
        </div>

        {/* Right Column: Ticket List */}
        <div>
          <section>
            <h2 style={{ marginTop: 0, fontSize: '20px', marginBottom: '15px' }}>Tickets</h2>
            {ticketsLoading ? (
              <div>Loading tickets...</div>
            ) : ticketsError ? (
              <div style={{ color: 'red' }}>Error loading tickets</div>
            ) : tickets && tickets.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {tickets.map((ticket: any) => {
                  const statusBadgeValue = ticket.isEscalated ? 'ESCALATED' : ticket.status
                  const statusBadgeColor = statusBadgeValue === 'ESCALATED' ? '#f44336' : statusBadgeValue === 'RESOLVED' ? '#4caf50' : '#ff9800'
                  
                  return (
                    <div 
                      key={ticket.id} 
                      data-testid="ticket-item"
                      style={{ padding: '20px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e0e0e0', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '10px' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <h3 style={{ margin: 0, fontSize: '18px', color: '#333' }}>{ticket.title}</h3>
                        <span 
                          data-testid={`ticket-status-badge-${ticket.id}`}
                          style={{ backgroundColor: statusBadgeColor, color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}
                        >
                          {statusBadgeValue}
                        </span>
                      </div>

                      <p style={{ margin: 0, color: '#666', fontSize: '14px', lineHeight: '1.4' }}>{ticket.description}</p>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px', borderTop: '1px solid #eee', paddingTop: '10px', marginTop: '5px' }}>
                        <div>
                          <strong>Priority:</strong> {ticket.priority}
                        </div>
                        <div>
                          <strong>Status:</strong> {ticket.status}
                        </div>
                        <div>
                          <strong>Assignee:</strong> <span data-testid={`ticket-assignee-${ticket.id}`}>{ticket.assignee ? ticket.assignee.username : 'Unassigned'}</span>
                        </div>
                        <div>
                          <strong>Escalated:</strong> <span data-testid={`ticket-escalated-${ticket.id}`}>{ticket.isEscalated ? 'Yes' : 'No'}</span>
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                          <strong>SLA Deadline:</strong> <span data-testid={`ticket-sla-deadline-${ticket.id}`}>{new Date(ticket.slaDeadline).toISOString()}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                        <button 
                          data-testid={`simulate-breach-${ticket.id}`}
                          onClick={() => handleSimulateBreach(ticket.id)}
                          style={{ padding: '6px 12px', backgroundColor: '#ff9800', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                        >
                          Simulate SLA Breach
                        </button>
                        {ticket.status !== 'RESOLVED' && (
                          <button 
                            onClick={() => handleResolve(ticket.id)}
                            style={{ padding: '6px 12px', backgroundColor: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                          >
                            Resolve Ticket
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#f9f9f9', borderRadius: '8px', border: '1px dashed #ccc', color: '#666' }}>
                No tickets found. Create one on the left to get started!
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
