import { HttpError } from "wasp/server";

export const getTickets = async (_args: any, context: any) => {
  if (!context.user) {
    throw new HttpError(401, "User is not authenticated");
  }
  return context.entities.Ticket.findMany({
    include: {
      assignee: true,
      creator: true,
    },
    orderBy: {
      id: "desc",
    }
  });
};

export const getAgents = async (_args: any, context: any) => {
  if (!context.user) {
    throw new HttpError(401, "User is not authenticated");
  }
  const agents = await context.entities.User.findMany({
    where: { role: "AGENT" },
    include: {
      assignedTickets: {
        where: { status: { not: "RESOLVED" } }
      }
    }
  });
  
  return agents.map((agent: any) => ({
    id: agent.id,
    username: agent.username,
    role: agent.role,
    workload: agent.assignedTickets.length,
  }));
};
