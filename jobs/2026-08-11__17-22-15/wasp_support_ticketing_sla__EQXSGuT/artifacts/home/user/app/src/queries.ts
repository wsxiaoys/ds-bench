import { HttpError } from "wasp/server";

export const getTickets = async (args: any, context: any) => {
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

export const getAgents = async (args: any, context: any) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  const agents = await context.entities.User.findMany({
    where: { role: "AGENT" },
    include: {
      ticketsAssigned: {
        where: { status: { not: "RESOLVED" } },
      },
    },
  });
  return agents.map((agent: any) => ({
    id: agent.id,
    username: agent.username,
    role: agent.role,
    workload: agent.ticketsAssigned.length,
  }));
};
