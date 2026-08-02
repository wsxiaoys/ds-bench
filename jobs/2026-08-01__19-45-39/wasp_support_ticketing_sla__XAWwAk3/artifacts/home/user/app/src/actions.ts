import { HttpError } from "wasp/server";
import type { Ticket } from "wasp/entities";
import type {
  CreateTicket,
  SimulateSlaBreach,
} from "wasp/server/operations";

export type Priority = "HIGH" | "MEDIUM" | "LOW";

const SLA_SECONDS: Record<Priority, number> = {
  HIGH: 3600,
  MEDIUM: 14400,
  LOW: 86400,
};

type CreateTicketInput = {
  title: string;
  description: string;
  priority: Priority;
};

export const createTicket: CreateTicket<CreateTicketInput, Ticket> = async (
  args,
  context,
) => {
  if (!context.user) {
    throw new HttpError(401, "You must be logged in to create a ticket");
  }

  const { title, description, priority } = args;

  const now = new Date();
  const slaDeadline = new Date(
    now.getTime() + SLA_SECONDS[priority] * 1000,
  );

  // Find the agent with the lowest number of active (unresolved) tickets.
  // Ties are broken by picking the agent with the smallest id.
  const agents = await context.entities.User.findMany({
    where: { role: "AGENT" },
    orderBy: { id: "asc" },
  });

  let assigneeId: number | undefined;

  if (agents.length > 0) {
    const agentsWithWorkload = await Promise.all(
      agents.map(async (agent) => {
        const workload = await context.entities.Ticket.count({
          where: {
            assigneeId: agent.id,
            status: { not: "RESOLVED" },
          },
        });
        return { id: agent.id, workload };
      }),
    );

    agentsWithWorkload.sort((a, b) => {
      if (a.workload !== b.workload) {
        return a.workload - b.workload;
      }
      return a.id - b.id;
    });

    assigneeId = agentsWithWorkload[0].id;
  }

  const ticket = await context.entities.Ticket.create({
    data: {
      title,
      description,
      priority,
      slaDeadline,
      creator: { connect: { id: context.user.id } },
      ...(assigneeId !== undefined
        ? { assignee: { connect: { id: assigneeId } } }
        : {}),
    },
  });

  return ticket;
};

type SimulateSlaBreachInput = {
  ticketId: number;
};

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export const simulateSlaBreach: SimulateSlaBreach<
  SimulateSlaBreachInput,
  Ticket
> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "You must be logged in");
  }

  const { ticketId } = args;

  const ticket = await context.entities.Ticket.findUnique({
    where: { id: ticketId },
  });

  if (!ticket) {
    throw new HttpError(404, "Ticket not found");
  }

  const newCreatedAt = new Date(ticket.createdAt.getTime() - TWO_HOURS_MS);
  const newSlaDeadline = new Date(
    ticket.slaDeadline.getTime() - TWO_HOURS_MS,
  );

  let updatedTicket = await context.entities.Ticket.update({
    where: { id: ticketId },
    data: {
      createdAt: newCreatedAt,
      slaDeadline: newSlaDeadline,
    },
  });

  const isBreached =
    updatedTicket.slaDeadline.getTime() < Date.now() &&
    updatedTicket.status !== "RESOLVED" &&
    !updatedTicket.isEscalated;

  if (isBreached) {
    const manager = await context.entities.User.findFirst({
      where: { role: "MANAGER" },
      orderBy: { id: "asc" },
    });

    updatedTicket = await context.entities.Ticket.update({
      where: { id: ticketId },
      data: {
        isEscalated: true,
        ...(manager
          ? { assignee: { connect: { id: manager.id } } }
          : {}),
      },
    });
  }

  return updatedTicket;
};
