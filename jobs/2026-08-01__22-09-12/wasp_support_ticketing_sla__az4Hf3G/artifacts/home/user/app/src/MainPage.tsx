import { useState } from "react";
import { useQuery, useAction } from "wasp/client/operations";
import { getTickets, getAgents } from "wasp/client/operations";
import { createTicket, simulateSlaBreach } from "wasp/client/operations";
import { useAuth, logout } from "wasp/client/auth";
import type { AuthUser } from "wasp/auth";
import type { Ticket } from "wasp/entities";
import "./Main.css";

type Agent = {
  id: number;
  username: string;
  workload: number;
};

export function MainPage() {
  const { data: user } = useAuth();
  const { data: tickets, refetch: refetchTickets } = useQuery(getTickets);
  const { data: agents, refetch: refetchAgents } = useQuery(getAgents);

  const createTicketFn = useAction(createTicket);
  const simulateSlaBreachFn = useAction(simulateSlaBreach);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"HIGH" | "MEDIUM" | "LOW">("MEDIUM");

  const handleSubmit = async () => {
    try {
      await createTicketFn({ title, description, priority });
      setTitle("");
      setDescription("");
      setPriority("MEDIUM");
      await refetchTickets();
      await refetchAgents();
    } catch (err) {
      console.error("Failed to create ticket:", err);
    }
  };

  const handleSimulateBreach = async (ticketId: number) => {
    try {
      await simulateSlaBreachFn({ ticketId });
      await refetchTickets();
      await refetchAgents();
    } catch (err) {
      console.error("Failed to simulate SLA breach:", err);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const formatDate = (date: Date) => {
    return new Date(date).toISOString();
  };

  const getStatusBadge = (ticket: any) => {
    if (ticket.isEscalated) {
      return "ESCALATED";
    }
    return ticket.status;
  };

  return (
    <main className="container">
      <div className="header">
        <div className="user-info">
          <p>
            Logged in as: <strong>{user?.username}</strong> (Role:{" "}
            {user?.role ?? "N/A"})
          </p>
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      <section className="agents-section">
        <h2>Agents & Workloads</h2>
        <div className="agents-list">
          {agents?.map((agent: Agent) => (
            <div
              key={agent.id}
              className="agent-item"
              data-testid={`agent-workload-${agent.username}`}
            >
              {agent.username}: {agent.workload}
            </div>
          ))}
          {(!agents || agents.length === 0) && <p>No agents found.</p>}
        </div>
      </section>

      <section className="create-ticket-section">
        <h2>Create Ticket</h2>
        <div className="form-group">
          <label htmlFor="ticket-title">Title</label>
          <input
            type="text"
            id="ticket-title"
            data-testid="ticket-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="ticket-desc">Description</label>
          <textarea
            id="ticket-desc"
            data-testid="ticket-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="ticket-priority">Priority</label>
          <select
            id="ticket-priority"
            data-testid="ticket-priority"
            value={priority}
            onChange={(e) =>
              setPriority(e.target.value as "HIGH" | "MEDIUM" | "LOW")
            }
          >
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>
        </div>
        <button
          id="submit-ticket"
          data-testid="submit-ticket"
          onClick={handleSubmit}
        >
          Submit Ticket
        </button>
      </section>

      <section className="tickets-section">
        <h2>Tickets</h2>
        {(!tickets || tickets.length === 0) && <p>No tickets yet.</p>}
        <div className="tickets-list">
          {tickets?.map((ticket: any) => (
            <div
              key={ticket.id}
              className="ticket-item"
              data-testid="ticket-item"
            >
              <h3>{ticket.title}</h3>
              <p>
                <strong>Priority:</strong> {ticket.priority}
              </p>
              <p>
                <strong>Status:</strong>{" "}
                <span data-testid={`ticket-status-badge-${ticket.id}`}>
                  {getStatusBadge(ticket)}
                </span>
              </p>
              <p>
                <strong>SLA Deadline:</strong>{" "}
                <span data-testid={`ticket-sla-deadline-${ticket.id}`}>
                  {formatDate(ticket.slaDeadline)}
                </span>
              </p>
              <p>
                <strong>Assignee:</strong>{" "}
                <span data-testid={`ticket-assignee-${ticket.id}`}>
                  {ticket.assignee ? ticket.assignee.username : "Unassigned"}
                </span>
              </p>
              <p>
                <strong>Escalated:</strong>{" "}
                <span data-testid={`ticket-escalated-${ticket.id}`}>
                  {ticket.isEscalated ? "Yes" : "No"}
                </span>
              </p>
              <button
                data-testid={`simulate-breach-${ticket.id}`}
                onClick={() => handleSimulateBreach(ticket.id)}
              >
                Simulate SLA Breach
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
