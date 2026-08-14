import { HttpError } from "wasp/server";
import type { GetTickets, GetAgents } from "wasp/server/operations";

export const getTickets: GetTickets<void, any> = async (args, context) => {
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

export const getAgents: GetAgents<void, any> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const agents = await context.entities.User.findMany({
    where: { role: "AGENT" },
    include: {
      ticketsAssigned: {
        where: {
          status: { not: "RESOLVED" },
        },
      },
    },
    orderBy: {
      id: "asc",
    },
  });

  return agents.map((agent: any) => ({
    id: agent.id,
    username: agent.username,
    role: agent.role,
    workload: agent.ticketsAssigned.length,
  }));
};
