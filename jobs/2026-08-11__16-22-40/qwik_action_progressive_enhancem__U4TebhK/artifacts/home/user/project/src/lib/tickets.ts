export type Priority = "low" | "medium" | "high";

export interface Ticket {
  id: number;
  title: string;
  priority: Priority;
  description: string;
}

const tickets: Ticket[] = [
  {
    id: 1,
    title: "Set up CI pipeline",
    priority: "high",
    description: "Configure the continuous integration pipeline for the repo.",
  },
  {
    id: 2,
    title: "Write onboarding docs",
    priority: "low",
    description: "Document the local development setup for new engineers.",
  },
];

let nextId = 3;

export function listTickets(): Ticket[] {
  return tickets.map((t) => ({ ...t }));
}

export function addTicket(data: Omit<Ticket, "id">): Ticket {
  const ticket: Ticket = { id: nextId++, ...data };
  tickets.push(ticket);
  return ticket;
}
