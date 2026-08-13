import { useState } from "react";
import { type AuthUser } from "wasp/auth";
import { logout } from "wasp/client/auth";
import {
  useQuery,
  getTickets,
  getAgents,
  createTicket,
  simulateSlaBreach,
} from "wasp/client/operations";

export function MainPage({ user }: { user: AuthUser }) {
  const { data: tickets, isLoading: ticketsLoading } = useQuery(getTickets);
  const { data: agents, isLoading: agentsLoading } = useQuery(getAgents);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"HIGH" | "MEDIUM" | "LOW">("LOW");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      alert("Title and description are required");
      return;
    }
    setSubmitting(true);
    try {
      await createTicket({ title, description, priority });
      setTitle("");
      setDescription("");
      setPriority("LOW");
    } catch (err: any) {
      alert(err.message || "Failed to create ticket");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSimulateBreach = async (ticketId: number) => {
    try {
      await simulateSlaBreach({ ticketId });
    } catch (err: any) {
      alert(err.message || "Failed to simulate SLA breach");
    }
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem", fontFamily: "sans-serif" }}>
      {/* Header */}
      <header style={{ display: "flex", justifyContent: "between", alignItems: "center", borderBottom: "1px solid #e5e7eb", paddingBottom: "1rem", marginBottom: "2rem" }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: "1.875rem", fontWeight: "bold", color: "#111827", margin: 0 }}>Support Ticket System</h1>
          <p style={{ color: "#4b5563", margin: "0.25rem 0 0 0" }}>
            Logged in as: <strong style={{ color: "#111827" }}>{user.username}</strong> ({user.role})
          </p>
        </div>
        <button
          onClick={logout}
          style={{
            backgroundColor: "#ef4444",
            color: "white",
            padding: "0.5rem 1rem",
            borderRadius: "0.375rem",
            border: "none",
            cursor: "pointer",
            fontWeight: "bold",
            transition: "background-color 0.2s",
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#dc2626")}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#ef4444")}
        >
          Logout
        </button>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "2rem" }}>
        {/* Left Column: Agents & Create Ticket */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {/* Agents List */}
          <section style={{ backgroundColor: "white", padding: "1.5rem", borderRadius: "0.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", border: "1px solid #e5e7eb" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "1rem", color: "#1f2937" }}>Agent Workload</h2>
            {agentsLoading ? (
              <p style={{ color: "#6b7280" }}>Loading agents...</p>
            ) : !agents || agents.length === 0 ? (
              <p style={{ color: "#6b7280" }}>No agents in the system.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {agents.map((agent: any) => (
                  <div
                    key={agent.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.75rem",
                      backgroundColor: "#f9fafb",
                      borderRadius: "0.375rem",
                      border: "1px solid #f3f4f6",
                    }}
                  >
                    <span style={{ fontWeight: 500, color: "#374151" }}>{agent.username}</span>
                    <span
                      data-testid={`agent-workload-${agent.username}`}
                      style={{
                        backgroundColor: "#e0f2fe",
                        color: "#0369a1",
                        fontWeight: "bold",
                        padding: "0.25rem 0.75rem",
                        borderRadius: "9999px",
                        fontSize: "0.875rem",
                      }}
                    >
                      {agent.workload}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Ticket Creation Form */}
          <section style={{ backgroundColor: "white", padding: "1.5rem", borderRadius: "0.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", border: "1px solid #e5e7eb" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "1rem", color: "#1f2937" }}>Create New Ticket</h2>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label htmlFor="ticket-title" style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, color: "#374151", marginBottom: "0.25rem" }}>
                  Title
                </label>
                <input
                  type="text"
                  id="ticket-title"
                  data-testid="ticket-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{
                    width: "100%",
                    borderRadius: "0.375rem",
                    border: "1px solid #d1d5db",
                    padding: "0.5rem",
                    fontSize: "0.875rem",
                    boxSizing: "border-box",
                  }}
                  required
                />
              </div>

              <div>
                <label htmlFor="ticket-desc" style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, color: "#374151", marginBottom: "0.25rem" }}>
                  Description
                </label>
                <textarea
                  id="ticket-desc"
                  data-testid="ticket-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  style={{
                    width: "100%",
                    borderRadius: "0.375rem",
                    border: "1px solid #d1d5db",
                    padding: "0.5rem",
                    fontSize: "0.875rem",
                    boxSizing: "border-box",
                  }}
                  required
                ></textarea>
              </div>

              <div>
                <label htmlFor="ticket-priority" style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, color: "#374151", marginBottom: "0.25rem" }}>
                  Priority
                </label>
                <select
                  id="ticket-priority"
                  data-testid="ticket-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  style={{
                    width: "100%",
                    borderRadius: "0.375rem",
                    border: "1px solid #d1d5db",
                    padding: "0.5rem",
                    fontSize: "0.875rem",
                    backgroundColor: "white",
                    boxSizing: "border-box",
                  }}
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
                disabled={submitting}
                style={{
                  backgroundColor: "#2563eb",
                  color: "white",
                  padding: "0.625rem",
                  borderRadius: "0.375rem",
                  border: "none",
                  fontWeight: "bold",
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#1d4ed8")}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#2563eb")}
              >
                {submitting ? "Submitting..." : "Submit Ticket"}
              </button>
            </form>
          </section>
        </div>

        {/* Right Column: Ticket List */}
        <div>
          <section style={{ backgroundColor: "white", padding: "1.5rem", borderRadius: "0.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", border: "1px solid #e5e7eb" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "1rem", color: "#1f2937" }}>Tickets</h2>
            {ticketsLoading ? (
              <p style={{ color: "#6b7280" }}>Loading tickets...</p>
            ) : !tickets || tickets.length === 0 ? (
              <p style={{ color: "#6b7280" }}>No tickets created yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {tickets.map((ticket: any) => {
                  // Determine priority badge styles
                  let priorityColor = "#10b981";
                  let priorityBg = "#ecfdf5";
                  if (ticket.priority === "HIGH") {
                    priorityColor = "#ef4444";
                    priorityBg = "#fef2f2";
                  } else if (ticket.priority === "MEDIUM") {
                    priorityColor = "#f59e0b";
                    priorityBg = "#fffbeb";
                  }

                  // Determine status badge text and styles
                  const statusText = ticket.isEscalated ? "ESCALATED" : ticket.status;
                  let badgeBg = "#f3f4f6";
                  let badgeColor = "#374151";
                  if (ticket.isEscalated) {
                    badgeBg = "#fef2f2";
                    badgeColor = "#991b1b";
                  } else if (ticket.status === "RESOLVED") {
                    badgeBg = "#ecfdf5";
                    badgeColor = "#065f46";
                  } else if (ticket.status === "OPEN") {
                    badgeBg = "#eff6ff";
                    badgeColor = "#1e40af";
                  }

                  return (
                    <div
                      key={ticket.id}
                      data-testid="ticket-item"
                      style={{
                        padding: "1.25rem",
                        borderRadius: "0.5rem",
                        border: "1px solid #e5e7eb",
                        backgroundColor: "#ffffff",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.75rem",
                      }}
                    >
                      {/* Title & Badge */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                        <div>
                          <h3 style={{ fontSize: "1.125rem", fontWeight: "bold", color: "#111827", margin: 0 }}>{ticket.title}</h3>
                          <p style={{ fontSize: "0.875rem", color: "#6b7280", margin: "0.25rem 0 0 0" }}>Created by: {ticket.creator?.username}</p>
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <span
                            style={{
                              backgroundColor: priorityBg,
                              color: priorityColor,
                              fontSize: "0.75rem",
                              fontWeight: "bold",
                              padding: "0.25rem 0.5rem",
                              borderRadius: "0.25rem",
                            }}
                          >
                            {ticket.priority}
                          </span>
                          <span
                            data-testid={`ticket-status-badge-${ticket.id}`}
                            style={{
                              backgroundColor: badgeBg,
                              color: badgeColor,
                              fontSize: "0.75rem",
                              fontWeight: "bold",
                              padding: "0.25rem 0.5rem",
                              borderRadius: "0.25rem",
                            }}
                          >
                            {statusText}
                          </span>
                        </div>
                      </div>

                      {/* Description */}
                      <p style={{ color: "#374151", fontSize: "0.875rem", margin: 0, lineHeight: 1.5 }}>{ticket.description}</p>

                      {/* Details Grid */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.875rem", color: "#4b5563", borderTop: "1px solid #f3f4f6", paddingTop: "0.75rem" }}>
                        <div>
                          <strong>Assignee: </strong>
                          <span data-testid={`ticket-assignee-${ticket.id}`}>
                            {ticket.assignee ? ticket.assignee.username : "Unassigned"}
                          </span>
                        </div>
                        <div>
                          <strong>SLA Deadline: </strong>
                          <span data-testid={`ticket-sla-deadline-${ticket.id}`}>
                            {new Date(ticket.slaDeadline).toISOString()}
                          </span>
                        </div>
                        <div>
                          <strong>Escalated: </strong>
                          <span data-testid={`ticket-escalated-${ticket.id}`}>
                            {ticket.isEscalated ? "Yes" : "No"}
                          </span>
                        </div>
                        <div>
                          <strong>Status: </strong>
                          <span>{ticket.status}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                        <button
                          data-testid={`simulate-breach-${ticket.id}`}
                          onClick={() => handleSimulateBreach(ticket.id)}
                          style={{
                            backgroundColor: "#f3f4f6",
                            color: "#374151",
                            border: "1px solid #d1d5db",
                            padding: "0.375rem 0.75rem",
                            borderRadius: "0.375rem",
                            fontSize: "0.875rem",
                            cursor: "pointer",
                            fontWeight: 500,
                            transition: "background-color 0.2s",
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.backgroundColor = "#e5e7eb";
                            e.currentTarget.style.color = "#111827";
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.backgroundColor = "#f3f4f6";
                            e.currentTarget.style.color = "#374151";
                          }}
                        >
                          Simulate SLA Breach
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
