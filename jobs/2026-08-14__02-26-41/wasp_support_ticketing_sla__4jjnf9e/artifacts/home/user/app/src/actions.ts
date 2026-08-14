import { HttpError } from "wasp/server";

type CreateTicketArgs = {
  title: string;
  description: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
};

export const createTicket = async (args: CreateTicketArgs, context: any) => {
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

  let assigneeId: number | null = null;
  if (agents.length > 0) {
    // Sort agents by workload count ascending, and then by id ascending
    agents.sort((a: any, b: any) => {
      const workloadA = a.assignedTickets.length;
      const workloadB = b.assignedTickets.length;
      if (workloadA !== workloadB) {
        return workloadA - workloadB;
      }
      return a.id - b.id;
    });
    assigneeId = agents[0].id;
  }

  const now = new Date();
  let durationSeconds = 86400; // default LOW
  if (args.priority === "HIGH") {
    durationSeconds = 3600;
  } else if (args.priority === "MEDIUM") {
    durationSeconds = 14400;
  } else if (args.priority === "LOW") {
    durationSeconds = 86400;
  }
  const slaDeadline = new Date(now.getTime() + durationSeconds * 1000);

  const newTicket = await context.entities.Ticket.create({
    data: {
      title: args.title,
      description: args.description,
      priority: args.priority,
      status: "OPEN",
      createdAt: now,
      slaDeadline: slaDeadline,
      isEscalated: false,
      assigneeId: assigneeId,
      creatorId: context.user.id,
    },
    include: {
      assignee: true,
      creator: true,
    }
  });

  return newTicket;
};

type SimulateSlaBreachArgs = {
  ticketId: number;
};

export const simulateSlaBreach = async (args: SimulateSlaBreachArgs, context: any) => {
  if (!context.user) {
    throw new HttpError(401, "User is not authenticated");
  }

  const ticket = await context.entities.Ticket.findUnique({
    where: { id: args.ticketId },
  });
  if (!ticket) {
    throw new HttpError(404, "Ticket not found");
  }

  // Subtract exactly 2 hours (2 * 3600 * 1000 ms) from both createdAt and slaDeadline
  const updatedCreatedAt = new Date(ticket.createdAt.getTime() - 2 * 3600 * 1000);
  const updatedSlaDeadline = new Date(ticket.slaDeadline.getTime() - 2 * 3600 * 1000);

  await context.entities.Ticket.update({
    where: { id: args.ticketId },
    data: {
      createdAt: updatedCreatedAt,
      slaDeadline: updatedSlaDeadline,
    }
  });

  const now = new Date();
  const hasSlaBreached = updatedSlaDeadline.getTime() < now.getTime() && ticket.status !== "RESOLVED" && !ticket.isEscalated;

  let nextAssigneeId = ticket.assigneeId;
  let nextIsEscalated = ticket.isEscalated;

  if (hasSlaBreached) {
    nextIsEscalated = true;
    const managers = await context.entities.User.findMany({
      where: { role: "MANAGER" },
      orderBy: { id: "asc" },
    });
    if (managers.length > 0) {
      nextAssigneeId = managers[0].id;
    }
  }

  const finalTicket = await context.entities.Ticket.update({
    where: { id: args.ticketId },
    data: {
      isEscalated: nextIsEscalated,
      assigneeId: nextAssigneeId,
    },
    include: {
      assignee: true,
      creator: true,
    }
  });

  return finalTicket;
};
