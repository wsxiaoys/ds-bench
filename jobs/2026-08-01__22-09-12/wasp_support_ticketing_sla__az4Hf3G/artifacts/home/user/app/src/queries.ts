import type { GetTickets, GetAgents } from "wasp/server/operations";

type TicketWithRelations = {
  id: number;
  title: string;
  description: string;
  priority: string;
  status: string;
  createdAt: Date;
  slaDeadline: Date;
  isEscalated: boolean;
  assigneeId: number | null;
  creatorId: number;
  assignee: {
    id: number;
    username: string;
    password: string;
    role: string;
  } | null;
  creator: {
    id: number;
    username: string;
    password: string;
    role: string;
  };
};

type AgentWithWorkload = {
  id: number;
  username: string;
  workload: number;
};

export const getTickets: GetTickets<void, TicketWithRelations[]> = async (_args, context) => {
  return context.entities.Ticket.findMany({
    include: {
      assignee: true,
      creator: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};

export const getAgents: GetAgents<void, AgentWithWorkload[]> = async (_args, context) => {
  const agents = await context.entities.User.findMany({
    where: { role: "AGENT" },
    include: {
      assignedTickets: {
        where: {
          status: { not: "RESOLVED" },
        },
      },
    },
  });

  return agents.map((agent) => ({
    id: agent.id,
    username: agent.username,
    workload: agent.assignedTickets.length,
  }));
};
