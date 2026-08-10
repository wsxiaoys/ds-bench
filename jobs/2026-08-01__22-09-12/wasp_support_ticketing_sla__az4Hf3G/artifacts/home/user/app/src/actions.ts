import type { CreateTicket, SimulateSlaBreach } from "wasp/server/operations";

type TicketWithRelations = {
  id: number;
  title: string;
  description: string;
  priority: string;
  status: string;
  createdAt: Date;
  slaDeadline: Date;
  isEscalated: boolean;
  assigneeId: number | null;
  creatorId: number;
  assignee: {
    id: number;
    username: string;
    password: string;
    role: string;
  } | null;
  creator: {
    id: number;
    username: string;
    password: string;
    role: string;
  };
};

type CreateTicketInput = {
  title: string;
  description: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
};

type SimulateSlaBreachInput = {
  ticketId: number;
};

export const createTicket: CreateTicket<CreateTicketInput, TicketWithRelations> = async (args, context) => {
  if (!context.user) {
    throw new Error("Authentication required");
  }

  const now = new Date();
  let slaSeconds: number;

  switch (args.priority) {
    case "HIGH":
      slaSeconds = 3600; // 1 hour
      break;
    case "MEDIUM":
      slaSeconds = 14400; // 4 hours
      break;
    case "LOW":
      slaSeconds = 86400; // 24 hours
      break;
    default:
      throw new Error("Invalid priority");
  }

  const slaDeadline = new Date(now.getTime() + slaSeconds * 1000);

  // Find the agent with the lowest workload
  const agents = await context.entities.User.findMany({
    where: { role: "AGENT" },
    include: {
      assignedTickets: {
        where: {
          status: { not: "RESOLVED" },
        },
      },
    },
  });

  let assigneeId: number | null = null;

  if (agents.length > 0) {
    // Find agent with lowest workload; tie-break by smallest id
    let lowestAgent = agents[0];
    let lowestWorkload = lowestAgent.assignedTickets.length;

    for (let i = 1; i < agents.length; i++) {
      const workload = agents[i].assignedTickets.length;
      if (workload < lowestWorkload || (workload === lowestWorkload && agents[i].id < lowestAgent.id)) {
        lowestAgent = agents[i];
        lowestWorkload = workload;
      }
    }

    assigneeId = lowestAgent.id;
  }

  const ticket = await context.entities.Ticket.create({
    data: {
      title: args.title,
      description: args.description,
      priority: args.priority,
      status: "OPEN",
      slaDeadline,
      creatorId: context.user.id,
      assigneeId,
    },
    include: {
      assignee: true,
      creator: true,
    },
  });

  return ticket;
};

export const simulateSlaBreach: SimulateSlaBreach<SimulateSlaBreachInput, TicketWithRelations> = async (args, context) => {
  const ticket = await context.entities.Ticket.findUnique({
    where: { id: args.ticketId },
    include: {
      assignee: true,
      creator: true,
    },
  });

  if (!ticket) {
    throw new Error("Ticket not found");
  }

  // Subtract 2 hours from both createdAt and slaDeadline
  const twoHoursMs = 2 * 60 * 60 * 1000;
  const newCreatedAt = new Date(ticket.createdAt.getTime() - twoHoursMs);
  const newSlaDeadline = new Date(ticket.slaDeadline.getTime() - twoHoursMs);

  // Check if SLA has been breached
  const now = new Date();
  const isBreached =
    newSlaDeadline < now &&
    ticket.status !== "RESOLVED" &&
    !ticket.isEscalated;

  let newAssigneeId = ticket.assigneeId;
  let isEscalated = ticket.isEscalated;

  if (isBreached) {
    isEscalated = true;

    // Find manager with smallest id
    const managers = await context.entities.User.findMany({
      where: { role: "MANAGER" },
      orderBy: { id: "asc" },
    });

    if (managers.length > 0) {
      newAssigneeId = managers[0].id;
    }
    // If no manager exists, keep the current assignee but still set isEscalated
  }

  const updatedTicket = await context.entities.Ticket.update({
    where: { id: args.ticketId },
    data: {
      createdAt: newCreatedAt,
      slaDeadline: newSlaDeadline,
      isEscalated,
      assigneeId: newAssigneeId,
    },
    include: {
      assignee: true,
      creator: true,
    },
  });

  return updatedTicket;
};
