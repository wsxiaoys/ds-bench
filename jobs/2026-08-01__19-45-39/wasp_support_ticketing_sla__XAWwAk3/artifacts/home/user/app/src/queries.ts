import type { Ticket, User } from "wasp/entities";
import type { GetAgents, GetTickets } from "wasp/server/operations";

export type TicketWithRelations = Ticket & {
  assignee: User | null;
  creator: User;
};

export const getTickets: GetTickets<void, TicketWithRelations[]> = async (
  _args,
  context,
) => {
  return context.entities.Ticket.findMany({
    include: {
      assignee: true,
      creator: true,
    },
    orderBy: { id: "asc" },
  });
};

export type AgentWithWorkload = User & { workload: number };

export const getAgents: GetAgents<void, AgentWithWorkload[]> = async (
  _args,
  context,
) => {
  const agents = await context.entities.User.findMany({
    where: { role: "AGENT" },
    orderBy: { id: "asc" },
  });

  const agentsWithWorkload = await Promise.all(
    agents.map(async (agent) => {
      const workload = await context.entities.Ticket.count({
        where: {
          assigneeId: agent.id,
          status: { not: "RESOLVED" },
        },
      });
      return { ...agent, workload };
    }),
  );

  return agentsWithWorkload;
};
