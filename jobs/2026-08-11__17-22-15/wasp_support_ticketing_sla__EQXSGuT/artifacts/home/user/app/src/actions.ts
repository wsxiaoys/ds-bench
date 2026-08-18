import { HttpError } from "wasp/server";

export const createTicket = async (
  args: { title: string; description: string; priority: "HIGH" | "MEDIUM" | "LOW" },
  context: any
) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  let durationMs = 0;
  if (args.priority === "HIGH") {
    durationMs = 3600 * 1000;
  } else if (args.priority === "MEDIUM") {
    durationMs = 14400 * 1000;
  } else if (args.priority === "LOW") {
    durationMs = 86400 * 1000;
  } else {
    throw new HttpError(400, "Invalid priority");
  }
  const slaDeadline = new Date(Date.now() + durationMs);

  const agents = await context.entities.User.findMany({
    where: { role: "AGENT" },
    include: {
      ticketsAssigned: {
        where: { status: { not: "RESOLVED" } },
      },
    },
  });

  let assignedAgentId: number | null = null;
  if (agents.length > 0) {
    const agentWorkloads = agents.map((agent: any) => ({
      agent,
      workload: agent.ticketsAssigned.length,
    }));

    agentWorkloads.sort((a: any, b: any) => {
      if (a.workload !== b.workload) {
        return a.workload - b.workload;
      }
      return a.agent.id - b.agent.id;
    });

    assignedAgentId = agentWorkloads[0].agent.id;
  }

  return context.entities.Ticket.create({
    data: {
      title: args.title,
      description: args.description,
      priority: args.priority,
      slaDeadline,
      creatorId: context.user.id,
      assigneeId: assignedAgentId,
    },
    include: {
      assignee: true,
      creator: true,
    },
  });
};

export const simulateSlaBreach = async (args: { ticketId: number }, context: any) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const ticket = await context.entities.Ticket.findUnique({
    where: { id: args.ticketId },
    include: { assignee: true, creator: true },
  });

  if (!ticket) {
    throw new HttpError(404, "Ticket not found");
  }

  const newCreatedAt = new Date(ticket.createdAt.getTime() - 2 * 3600 * 1000);
  const newSlaDeadline = new Date(ticket.slaDeadline.getTime() - 2 * 3600 * 1000);

  let updatedTicket = await context.entities.Ticket.update({
    where: { id: args.ticketId },
    data: {
      createdAt: newCreatedAt,
      slaDeadline: newSlaDeadline,
    },
    include: { assignee: true, creator: true },
  });

  const isBreached =
    newSlaDeadline.getTime() < Date.now() &&
    updatedTicket.status !== "RESOLVED" &&
    !updatedTicket.isEscalated;

  if (isBreached) {
    const managers = await context.entities.User.findMany({
      where: { role: "MANAGER" },
      orderBy: { id: "asc" },
    });

    const managerToAssign = managers[0] || null;

    updatedTicket = await context.entities.Ticket.update({
      where: { id: args.ticketId },
      data: {
        isEscalated: true,
        assigneeId: managerToAssign ? managerToAssign.id : updatedTicket.assigneeId,
      },
      include: { assignee: true, creator: true },
    });
  }

  return updatedTicket;
};
