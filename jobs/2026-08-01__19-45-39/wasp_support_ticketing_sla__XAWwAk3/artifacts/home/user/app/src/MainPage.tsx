import { useState } from "react";
import type { AuthUser } from "wasp/auth";
import { logout } from "wasp/client/auth";
import {
  useQuery,
  getTickets,
  getAgents,
  createTicket,
  simulateSlaBreach,
} from "wasp/client/operations";
import "./Main.css";

type Priority = "HIGH" | "MEDIUM" | "LOW";

export function MainPage({ user }: { user: AuthUser }) {
  const { data: tickets } = useQuery(getTickets);
  const { data: agents } = useQuery(getAgents);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("HIGH");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) {
      return;
    }
    setIsSubmitting(true);
    try {
      await createTicket({ title, description, priority });
      setTitle("");
      setDescription("");
      setPriority("HIGH");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSimulateBreach = async (ticketId: number) => {
    await simulateSlaBreach({ ticketId });
  };

  return (
    <main className="container ticket-app">
      <header className="ticket-app-header">
        <p>
          Logged in as <strong>{user.username}</strong> ({user.role})
        </p>
        <button onClick={() => logout()}>Logout</button>
      </header>

      <section>
        <h2>Agents</h2>
        <ul>
          {agents?.map((agent) => (
            <li key={agent.id}>
              {agent.username}:{" "}
              <span data-testid={`agent-workload-${agent.username}`}>
                {agent.workload}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Create Ticket</h2>
        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="ticket-title">Title</label>
            <input
              type="text"
              id="ticket-title"
              data-testid="ticket-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="ticket-desc">Description</label>
            <textarea
              id="ticket-desc"
              data-testid="ticket-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="ticket-priority">Priority</label>
            <select
              id="ticket-priority"
              data-testid="ticket-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
            >
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>
          <button
            id="submit-ticket"
            data-testid="submit-ticket"
            type="submit"
            disabled={isSubmitting}
          >
            Submit Ticket
          </button>
        </form>
      </section>

      <section>
        <h2>Tickets</h2>
        <ul className="ticket-list">
          {tickets?.map((ticket) => (
            <li key={ticket.id} data-testid="ticket-item">
              <div>
                <strong>{ticket.title}</strong> — {ticket.priority} —{" "}
                {ticket.status}
              </div>
              <div>{ticket.description}</div>
              <div>
                Assignee:{" "}
                <span data-testid={`ticket-assignee-${ticket.id}`}>
                  {ticket.assignee ? ticket.assignee.username : "Unassigned"}
                </span>
              </div>
              <div>
                SLA Deadline:{" "}
                <span data-testid={`ticket-sla-deadline-${ticket.id}`}>
                  {new Date(ticket.slaDeadline).toISOString()}
                </span>
              </div>
              <div>
                Escalated:{" "}
                <span data-testid={`ticket-escalated-${ticket.id}`}>
                  {ticket.isEscalated ? "Yes" : "No"}
                </span>
              </div>
              <div>
                Status:{" "}
                <span data-testid={`ticket-status-badge-${ticket.id}`}>
                  {ticket.isEscalated ? "ESCALATED" : ticket.status}
                </span>
              </div>
              <button
                data-testid={`simulate-breach-${ticket.id}`}
                onClick={() => handleSimulateBreach(ticket.id)}
              >
                Simulate SLA Breach
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
