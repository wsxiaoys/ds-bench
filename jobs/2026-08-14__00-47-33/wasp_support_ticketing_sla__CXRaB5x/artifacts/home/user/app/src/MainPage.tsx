import React, { useState } from "react";
import { logout } from "wasp/client/auth";
import { useQuery, getTickets, getAgents, createTicket, simulateSlaBreach } from "wasp/client/operations";

export function MainPage({ user }: { user: any }) {
  const { data: tickets, error: ticketsError, isLoading: ticketsLoading } = useQuery(getTickets);
  const { data: agents, error: agentsError, isLoading: agentsLoading } = useQuery(getAgents);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"HIGH" | "MEDIUM" | "LOW">("LOW");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const username = user.username || user.identities?.username?.id || "Unknown";
  const role = user.role || "CUSTOMER";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!title.trim() || !description.trim()) {
      setFormError("Title and description are required.");
      return;
    }

    try {
      await createTicket({ title, description, priority });
      setTitle("");
      setDescription("");
      setPriority("LOW");
      setFormSuccess("Ticket created successfully!");
    } catch (err: any) {
      setFormError(err.message || "Failed to create ticket.");
    }
  };

  const handleSimulateBreach = async (ticketId: number) => {
    try {
      await simulateSlaBreach({ ticketId });
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to simulate SLA breach.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="bg-white shadow rounded-lg p-6 mb-8 flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Support Ticket System</h1>
            <p className="text-sm text-gray-600">
              Welcome back, <span className="font-semibold text-indigo-600">{username}</span> ({role})
            </p>
          </div>
          <button
            onClick={logout}
            className="mt-4 md:mt-0 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md text-sm transition"
          >
            Logout
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Create Ticket & Agent Workloads */}
          <div className="space-y-8 lg:col-span-1">
            {/* Ticket Form */}
            <section className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Ticket</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                {formError && <div className="text-red-600 text-sm">{formError}</div>}
                {formSuccess && <div className="text-green-600 text-sm">{formSuccess}</div>}

                <div>
                  <label htmlFor="ticket-title" className="block text-sm font-medium text-gray-700">
                    Title
                  </label>
                  <input
                    type="text"
                    id="ticket-title"
                    data-testid="ticket-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                    placeholder="Enter ticket title"
                  />
                </div>

                <div>
                  <label htmlFor="ticket-desc" className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    id="ticket-desc"
                    data-testid="ticket-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                    placeholder="Enter ticket details"
                  />
                </div>

                <div>
                  <label htmlFor="ticket-priority" className="block text-sm font-medium text-gray-700">
                    Priority
                  </label>
                  <select
                    id="ticket-priority"
                    data-testid="ticket-priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>

                <button
                  type="submit"
                  id="submit-ticket"
                  data-testid="submit-ticket"
                  className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md text-sm transition"
                >
                  Submit Ticket
                </button>
              </form>
            </section>

            {/* Agent Workloads */}
            <section className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Agent Workloads</h2>
              {agentsLoading ? (
                <p className="text-sm text-gray-500">Loading agents...</p>
              ) : agentsError ? (
                <p className="text-sm text-red-600">Error loading agents</p>
              ) : agents && agents.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {agents.map((agent: any) => (
                    <div key={agent.id} className="py-3 flex justify-between items-center text-sm">
                      <span className="font-medium text-gray-700">{agent.username}</span>
                      <span
                        data-testid={`agent-workload-${agent.username}`}
                        className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800"
                      >
                        {agent.workload}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No agents registered in the system.</p>
              )}
            </section>
          </div>

          {/* Right Column: Ticket List */}
          <div className="lg:col-span-2 space-y-4">
            <section className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Support Tickets</h2>
              {ticketsLoading ? (
                <p className="text-sm text-gray-500">Loading tickets...</p>
              ) : ticketsError ? (
                <p className="text-sm text-red-600">Error loading tickets</p>
              ) : tickets && tickets.length > 0 ? (
                <div className="space-y-4">
                  {tickets.map((ticket: any) => (
                    <div
                      key={ticket.id}
                      data-testid="ticket-item"
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-bold text-gray-900">{ticket.title}</h3>
                          <p className="text-xs text-gray-500">
                            Created by {ticket.creator?.username || "Unknown"}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <span className="px-2 py-1 text-xs font-semibold rounded bg-gray-100 text-gray-800">
                            {ticket.priority}
                          </span>
                          <span
                            data-testid={`ticket-status-badge-${ticket.id}`}
                            className={`px-2 py-1 text-xs font-semibold rounded ${
                              ticket.isEscalated
                                ? "bg-red-100 text-red-800"
                                : ticket.status === "RESOLVED"
                                ? "bg-green-100 text-green-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {ticket.isEscalated ? "ESCALATED" : ticket.status}
                          </span>
                        </div>
                      </div>

                      <p className="text-sm text-gray-700 mb-4">{ticket.description}</p>

                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-4 border-t pt-3">
                        <div>
                          <span className="font-medium">Assignee:</span>{" "}
                          <span data-testid={`ticket-assignee-${ticket.id}`}>
                            {ticket.assignee ? ticket.assignee.username : "Unassigned"}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">Escalated:</span>{" "}
                          <span data-testid={`ticket-escalated-${ticket.id}`}>
                            {ticket.isEscalated ? "Yes" : "No"}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="font-medium">SLA Deadline:</span>{" "}
                          <span data-testid={`ticket-sla-deadline-${ticket.id}`}>
                            {new Date(ticket.slaDeadline).toISOString()}
                          </span>
                        </div>
                      </div>

                      <button
                        data-testid={`simulate-breach-${ticket.id}`}
                        onClick={() => handleSimulateBreach(ticket.id)}
                        className="text-xs bg-amber-500 hover:bg-amber-600 text-white font-medium py-1 px-3 rounded transition"
                      >
                        Simulate SLA Breach
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No support tickets found.</p>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
