import React, { useState } from "react";
import type { AuthUser } from "wasp/auth";
import { logout } from "wasp/client/auth";
import { useQuery, getTickets, getAgents } from "wasp/client/operations";
import { createTicket, simulateSlaBreach } from "wasp/client/operations";

export function MainPage({ user }: { user: AuthUser }) {
  const { data: tickets, refetch: refetchTickets } = useQuery(getTickets);
  const { data: agents, refetch: refetchAgents } = useQuery(getAgents);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"HIGH" | "MEDIUM" | "LOW">("HIGH");

  const username = user.username || user.identities?.username?.id || "Unknown";
  const role = user.role || "CUSTOMER";

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) {
      alert("Please fill out all fields");
      return;
    }
    try {
      await createTicket({ title, description, priority });
      setTitle("");
      setDescription("");
      setPriority("HIGH");
      refetchTickets();
      refetchAgents();
    } catch (err: any) {
      alert(err.message || "Error creating ticket");
    }
  };

  const handleSimulateBreach = async (ticketId: number) => {
    try {
      await simulateSlaBreach({ ticketId });
      refetchTickets();
      refetchAgents();
    } catch (err: any) {
      alert(err.message || "Error simulating breach");
    }
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb", paddingBottom: "15px", marginBottom: "20px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "24px", color: "#111827" }}>Support Ticket System</h1>
          <p style={{ margin: "5px 0 0 0", color: "#4b5563" }}>
            Logged in as: <strong>{username}</strong> ({role})
          </p>
        </div>
        <button
          onClick={logout}
          style={{
            backgroundColor: "#ef4444",
            color: "white",
            border: "none",
            padding: "8px 16px",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "500"
          }}
        >
          Logout
        </button>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "30px" }}>
        {/* Left Column: Agents & Create Ticket */}
        <div>
          {/* Agents Workload */}
          <section style={{ backgroundColor: "#f9fafb", padding: "20px", borderRadius: "8px", border: "1px solid #e5e7eb", marginBottom: "20px" }}>
            <h2 style={{ marginTop: 0, marginBottom: "15px", fontSize: "18px", color: "#374151" }}>Agents Workload</h2>
            {agents && agents.length > 0 ? (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {agents.map((agent: any) => (
                  <li
                    key={agent.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "10px 0",
                      borderBottom: "1px solid #f3f4f6"
                    }}
                  >
                    <span>{agent.username}</span>
                    <span
                      data-testid={`agent-workload-${agent.username}`}
                      style={{ fontWeight: "bold", backgroundColor: "#e0f2fe", color: "#0369a1", padding: "2px 8px", borderRadius: "12px", fontSize: "14px" }}
                    >
                      {agent.workload}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: "#6b7280", margin: 0 }}>No agents available</p>
            )}
          </section>

          {/* Create Ticket Form */}
          <section style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
            <h2 style={{ marginTop: 0, marginBottom: "15px", fontSize: "18px", color: "#374151" }}>Create Ticket</h2>
            <form onSubmit={handleCreateTicket}>
              <div style={{ marginBottom: "15px" }}>
                <label htmlFor="ticket-title" style={{ display: "block", marginBottom: "5px", fontWeight: "500", color: "#4b5563" }}>Title</label>
                <input
                  type="text"
                  id="ticket-title"
                  data-testid="ticket-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #d1d5db", boxSizing: "border-box" }}
                  required
                />
              </div>
              <div style={{ marginBottom: "15px" }}>
                <label htmlFor="ticket-desc" style={{ display: "block", marginBottom: "5px", fontWeight: "500", color: "#4b5563" }}>Description</label>
                <textarea
                  id="ticket-desc"
                  data-testid="ticket-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #d1d5db", boxSizing: "border-box", minHeight: "100px" }}
                  required
                />
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label htmlFor="ticket-priority" style={{ display: "block", marginBottom: "5px", fontWeight: "500", color: "#4b5563" }}>Priority</label>
                <select
                  id="ticket-priority"
                  data-testid="ticket-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as "HIGH" | "MEDIUM" | "LOW")}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #d1d5db", boxSizing: "border-box" }}
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
                style={{
                  width: "100%",
                  backgroundColor: "#2563eb",
                  color: "white",
                  border: "none",
                  padding: "10px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: "600"
                }}
              >
                Submit Ticket
              </button>
            </form>
          </section>
        </div>

        {/* Right Column: Ticket List */}
        <div>
          <section style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "8px", border: "1px solid #e5e7eb", minHeight: "500px" }}>
            <h2 style={{ marginTop: 0, marginBottom: "20px", fontSize: "18px", color: "#374151" }}>Tickets List</h2>
            {tickets && tickets.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                {tickets.map((ticket: any) => {
                  const badgeStatus = ticket.isEscalated ? "ESCALATED" : ticket.status;
                  const deadlineStr = ticket.slaDeadline ? new Date(ticket.slaDeadline).toISOString() : "N/A";
                  const assigneeName = ticket.assignee ? ticket.assignee.username : "Unassigned";
                  const isEscalatedStr = ticket.isEscalated ? "Yes" : "No";

                  return (
                    <div
                      key={ticket.id}
                      data-testid="ticket-item"
                      style={{
                        padding: "15px",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        backgroundColor: ticket.isEscalated ? "#fff5f5" : "#ffffff",
                        position: "relative"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                        <h3 style={{ margin: 0, fontSize: "16px", color: "#111827" }}>{ticket.title}</h3>
                        <span
                          data-testid={`ticket-status-badge-${ticket.id}`}
                          style={{
                            fontSize: "12px",
                            fontWeight: "bold",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            backgroundColor: badgeStatus === "ESCALATED" ? "#fecaca" : badgeStatus === "RESOLVED" ? "#d1fae5" : "#fef3c7",
                            color: badgeStatus === "ESCALATED" ? "#991b1b" : badgeStatus === "RESOLVED" ? "#065f46" : "#92400e"
                          }}
                        >
                          {badgeStatus}
                        </span>
                      </div>

                      <p style={{ margin: "0 0 15px 0", color: "#4b5563", fontSize: "14px" }}>{ticket.description}</p>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "13px", color: "#6b7280", marginBottom: "15px" }}>
                        <div>
                          <strong>Priority:</strong> {ticket.priority}
                        </div>
                        <div>
                          <strong>Assignee: </strong>
                          <span data-testid={`ticket-assignee-${ticket.id}`} style={{ fontWeight: "500", color: "#374151" }}>
                            {assigneeName}
                          </span>
                        </div>
                        <div>
                          <strong>SLA Deadline: </strong>
                          <span data-testid={`ticket-sla-deadline-${ticket.id}`} style={{ fontWeight: "500", color: "#374151" }}>
                            {deadlineStr}
                          </span>
                        </div>
                        <div>
                          <strong>Escalated: </strong>
                          <span data-testid={`ticket-escalated-${ticket.id}`} style={{ fontWeight: "500", color: "#374151" }}>
                            {isEscalatedStr}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button
                          data-testid={`simulate-breach-${ticket.id}`}
                          onClick={() => handleSimulateBreach(ticket.id)}
                          style={{
                            backgroundColor: "#f3f4f6",
                            color: "#374151",
                            border: "1px solid #d1d5db",
                            padding: "6px 12px",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: "500"
                          }}
                        >
                          Simulate SLA Breach
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ color: "#6b7280", textAlign: "center", marginTop: "40px" }}>No tickets found</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
