import { HttpError } from "wasp/server";
import type { CreateTicket, SimulateSlaBreach } from "wasp/server/operations";

export const createTicket: CreateTicket<
  { title: string; description: string; priority: "HIGH" | "MEDIUM" | "LOW" },
  any
> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  // 1. Calculate SLA deadline
  const createdAt = new Date();
  let durationSeconds = 24 * 3600; // default LOW
  if (args.priority === "HIGH") {
    durationSeconds = 3600;
  } else if (args.priority === "MEDIUM") {
    durationSeconds = 14400;
  } else if (args.priority === "LOW") {
    durationSeconds = 86400;
  }
  const slaDeadline = new Date(createdAt.getTime() + durationSeconds * 1000);

  // 2. Automatic workload-based assignment
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

  let chosenAgent: any = null;
  if (agents.length > 0) {
    chosenAgent = agents[0];
    for (let i = 1; i < agents.length; i++) {
      if (agents[i].ticketsAssigned.length < chosenAgent.ticketsAssigned.length) {
        chosenAgent = agents[i];
      }
    }
  }

  const assigneeId = chosenAgent ? chosenAgent.id : null;

  // 3. Create and return the ticket
  return context.entities.Ticket.create({
    data: {
      title: args.title,
      description: args.description,
      priority: args.priority,
      status: "OPEN",
      createdAt,
      slaDeadline,
      isEscalated: false,
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

  // 1. Find the ticket
  const ticket = await context.entities.Ticket.findUnique({
    where: { id: args.ticketId },
  });

  if (!ticket) {
    throw new HttpError(404, "Ticket not found");
  }

  // 2. Subtract exactly 2 hours from both createdAt and slaDeadline
  const newCreatedAt = new Date(ticket.createdAt.getTime() - 2 * 3600 * 1000);
  const newSlaDeadline = new Date(ticket.slaDeadline.getTime() - 2 * 3600 * 1000);

  let updatedTicket = await context.entities.Ticket.update({
    where: { id: args.ticketId },
    data: {
      createdAt: newCreatedAt,
      slaDeadline: newSlaDeadline,
    },
    include: {
      assignee: true,
      creator: true,
    },
  });

  // 3. Check if breached (slaDeadline is in past, status is not RESOLVED, and isEscalated is false)
  const isBreached =
    newSlaDeadline.getTime() < Date.now() &&
    updatedTicket.status !== "RESOLVED" &&
    !updatedTicket.isEscalated;

  if (isBreached) {
    // Reassign to manager with smallest ID
    const managers = await context.entities.User.findMany({
      where: { role: "MANAGER" },
      orderBy: { id: "asc" },
    });

    const managerId = managers.length > 0 ? managers[0].id : undefined;

    const updateData: any = {
      isEscalated: true,
    };
    if (managerId !== undefined) {
      updateData.assigneeId = managerId;
    }

    updatedTicket = await context.entities.Ticket.update({
      where: { id: args.ticketId },
      data: updateData,
      include: {
        assignee: true,
        creator: true,
      },
    });
  }

  return updatedTicket;
};
