import type { GetTickets, GetAgents } from "wasp/server/operations";
import { HttpError } from "wasp/server";

export const getTickets: GetTickets<void, any[]> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
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

export const getAgents: GetAgents<void, any[]> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  const agents = await context.entities.User.findMany({
    where: {
      role: "AGENT",
    },
    include: {
      assignedTickets: {
        where: {
          status: {
            not: "RESOLVED",
          },
        },
      },
    },
    orderBy: {
      id: "asc",
    },
  });

  return agents.map((agent) => ({
    id: agent.id,
    username: agent.username,
    role: agent.role,
    workload: agent.assignedTickets.length,
  }));
};
