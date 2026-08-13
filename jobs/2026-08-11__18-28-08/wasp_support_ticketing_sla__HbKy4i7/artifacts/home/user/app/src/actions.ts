import type { CreateTicket, SimulateSlaBreach } from "wasp/server/operations";
import { HttpError } from "wasp/server";

export const createTicket: CreateTicket<
  { title: string; description: string; priority: "HIGH" | "MEDIUM" | "LOW" },
  any
> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const now = new Date();
  let seconds = 0;
  if (args.priority === "HIGH") {
    seconds = 3600;
  } else if (args.priority === "MEDIUM") {
    seconds = 14400;
  } else if (args.priority === "LOW") {
    seconds = 86400;
  } else {
    throw new HttpError(400, "Invalid priority");
  }

  const slaDeadline = new Date(now.getTime() + seconds * 1000);

  // Find lowest workload agent
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
  });

  let assigneeId: number | null = null;
  if (agents.length > 0) {
    const agentsWithWorkload = agents.map((agent) => ({
      id: agent.id,
      workload: agent.assignedTickets.length,
    }));

    agentsWithWorkload.sort((a, b) => {
      if (a.workload !== b.workload) {
        return a.workload - b.workload;
      }
      return a.id - b.id;
    });

    assigneeId = agentsWithWorkload[0].id;
  }

  return context.entities.Ticket.create({
    data: {
      title: args.title,
      description: args.description,
      priority: args.priority,
      slaDeadline,
      creatorId: context.user.id,
      assigneeId,
    },
    include: {
      assignee: true,
      creator: true,
    },
  });
};

export const simulateSlaBreach: SimulateSlaBreach<
  { ticketId: number },
  any
> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const ticket = await context.entities.Ticket.findUnique({
    where: { id: args.ticketId },
  });

  if (!ticket) {
    throw new HttpError(404, "Ticket not found");
  }

  const twoHoursInMs = 2 * 60 * 60 * 1000;
  const newCreatedAt = new Date(ticket.createdAt.getTime() - twoHoursInMs);
  const newSlaDeadline = new Date(ticket.slaDeadline.getTime() - twoHoursInMs);

  let updatedTicket = await context.entities.Ticket.update({
    where: { id: args.ticketId },
    data: {
      createdAt: newCreatedAt,
      slaDeadline: newSlaDeadline,
    },
  });

  if (newSlaDeadline < new Date() && updatedTicket.status !== "RESOLVED" && !updatedTicket.isEscalated) {
    const managers = await context.entities.User.findMany({
      where: { role: "MANAGER" },
      orderBy: { id: "asc" },
    });

    let assigneeIdToSet = updatedTicket.assigneeId;
    if (managers.length > 0) {
      assigneeIdToSet = managers[0].id;
    }

    updatedTicket = await context.entities.Ticket.update({
      where: { id: args.ticketId },
      data: {
        isEscalated: true,
        assigneeId: assigneeIdToSet,
      },
      include: {
        assignee: true,
        creator: true,
      },
    });
  } else {
    updatedTicket = await context.entities.Ticket.findUnique({
      where: { id: args.ticketId },
      include: {
        assignee: true,
        creator: true,
      },
    }) as any;
  }

  return updatedTicket;
};
