import type { CreateTicket, SimulateSlaBreach } from "wasp/server/operations";

export const createTicket: CreateTicket<
  { title: string; description: string; priority: "HIGH" | "MEDIUM" | "LOW" },
  any
> = async (args, context) => {
  if (!context.user) {
    throw new Error("Unauthorized");
  }

  const now = new Date();
  let durationSeconds = 0;
  if (args.priority === "HIGH") {
    durationSeconds = 3600;
  } else if (args.priority === "MEDIUM") {
    durationSeconds = 14400;
  } else if (args.priority === "LOW") {
    durationSeconds = 86400;
  } else {
    throw new Error("Invalid priority");
  }

  const slaDeadline = new Date(now.getTime() + durationSeconds * 1000);

  // Find the agent with the lowest workload
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

  let assignedAgentId: number | null = null;
  if (agents.length > 0) {
    // Sort agents by workload, then by id
    agents.sort((a, b) => {
      const workloadA = a.assignedTickets.length;
      const workloadB = b.assignedTickets.length;
      if (workloadA !== workloadB) {
        return workloadA - workloadB;
      }
      return a.id - b.id;
    });
    assignedAgentId = agents[0].id;
  }

  return context.entities.Ticket.create({
    data: {
      title: args.title,
      description: args.description,
      priority: args.priority,
      status: "OPEN",
      createdAt: now,
      slaDeadline: slaDeadline,
      isEscalated: false,
      creatorId: context.user.id,
      assigneeId: assignedAgentId,
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
    throw new Error("Unauthorized");
  }

  const ticket = await context.entities.Ticket.findUnique({
    where: { id: args.ticketId },
  });

  if (!ticket) {
    throw new Error("Ticket not found");
  }

  // Subtract exactly 2 hours (2 * 3600 * 1000 milliseconds)
  const newCreatedAt = new Date(ticket.createdAt.getTime() - 2 * 3600 * 1000);
  const newSlaDeadline = new Date(ticket.slaDeadline.getTime() - 2 * 3600 * 1000);

  // Update database first
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

  // Check if SLA has been breached based on the updated ticket values
  const now = new Date();
  if (
    updatedTicket.slaDeadline < now &&
    updatedTicket.status !== "RESOLVED" &&
    !updatedTicket.isEscalated
  ) {
    const managers = await context.entities.User.findMany({
      where: { role: "MANAGER" },
      orderBy: { id: "asc" },
    });

    const managerId = managers.length > 0 ? managers[0].id : undefined;

    updatedTicket = await context.entities.Ticket.update({
      where: { id: args.ticketId },
      data: {
        isEscalated: true,
        assigneeId: managerId !== undefined ? managerId : updatedTicket.assigneeId,
      },
      include: {
        assignee: true,
        creator: true,
      },
    });
  }

  return updatedTicket;
};
