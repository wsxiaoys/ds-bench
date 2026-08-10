import { HttpError } from 'wasp/server'

export const getTickets = async (_args: any, context: any) => {
  if (!context.user) {
    throw new HttpError(401, 'Unauthorized')
  }
  return context.entities.Ticket.findMany({
    include: {
      assignee: true,
      creator: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  })
}

export const getAgents = async (_args: any, context: any) => {
  if (!context.user) {
    throw new HttpError(401, 'Unauthorized')
  }
  
  const agents = await context.entities.User.findMany({
    where: {
      role: 'AGENT'
    },
    include: {
      assignedTickets: {
        where: {
          status: {
            not: 'RESOLVED'
          }
        }
      }
    },
    orderBy: {
      id: 'asc'
    }
  })
  
  return agents.map((agent: any) => ({
    id: agent.id,
    username: agent.username,
    role: agent.role,
    workload: agent.assignedTickets.length
  }))
}

export const createTicket = async (args: { title: string; description: string; priority: 'HIGH' | 'MEDIUM' | 'LOW' }, context: any) => {
  if (!context.user) {
    throw new HttpError(401, 'Unauthorized')
  }
  
  const { title, description, priority } = args
  if (!title || !description || !priority) {
    throw new HttpError(400, 'Title, description and priority are required')
  }
  
  // 1. Calculate SLA deadline
  const now = new Date()
  let seconds = 86400 // LOW: 24 hours
  if (priority === 'HIGH') {
    seconds = 3600 // HIGH: 1 hour
  } else if (priority === 'MEDIUM') {
    seconds = 14400 // MEDIUM: 4 hours
  }
  const slaDeadline = new Date(now.getTime() + seconds * 1000)
  
  // 2. Find agent with lowest workload
  const agents = await context.entities.User.findMany({
    where: {
      role: 'AGENT'
    },
    include: {
      assignedTickets: {
        where: {
          status: {
            not: 'RESOLVED'
          }
        }
      }
    }
  })
  
  let assigneeId: number | null = null
  if (agents.length > 0) {
    // Sort agents by active ticket count, then by ID
    agents.sort((a: any, b: any) => {
      const workloadA = a.assignedTickets.length
      const workloadB = b.assignedTickets.length
      if (workloadA !== workloadB) {
        return workloadA - workloadB
      }
      return a.id - b.id
    })
    assigneeId = agents[0].id
  }
  
  // 3. Create ticket
  const ticket = await context.entities.Ticket.create({
    data: {
      title,
      description,
      priority,
      status: 'OPEN',
      createdAt: now,
      slaDeadline,
      isEscalated: false,
      creatorId: context.user.id,
      assigneeId: assigneeId || undefined
    },
    include: {
      assignee: true,
      creator: true
    }
  })
  
  return ticket
}

export const simulateSlaBreach = async (args: { ticketId: number }, context: any) => {
  if (!context.user) {
    throw new HttpError(401, 'Unauthorized')
  }
  
  const { ticketId } = args
  const ticket = await context.entities.Ticket.findUnique({
    where: { id: ticketId }
  })
  
  if (!ticket) {
    throw new HttpError(404, 'Ticket not found')
  }
  
  // Subtract 2 hours (2 * 3600 * 1000 milliseconds)
  const twoHours = 2 * 3600 * 1000
  const newCreatedAt = new Date(ticket.createdAt.getTime() - twoHours)
  const newSlaDeadline = new Date(ticket.slaDeadline.getTime() - twoHours)
  
  // Update in database first
  let updatedTicket = await context.entities.Ticket.update({
    where: { id: ticketId },
    data: {
      createdAt: newCreatedAt,
      slaDeadline: newSlaDeadline
    },
    include: {
      assignee: true,
      creator: true
    }
  })
  
  // Check if breached (slaDeadline is in the past, status is not RESOLVED, and isEscalated is false)
  const now = new Date()
  const isBreached = updatedTicket.slaDeadline.getTime() < now.getTime() && 
                     updatedTicket.status !== 'RESOLVED' && 
                     !updatedTicket.isEscalated
                     
  if (isBreached) {
    // Find manager with smallest ID
    const managers = await context.entities.User.findMany({
      where: { role: 'MANAGER' },
      orderBy: { id: 'asc' },
      take: 1
    })
    
    const managerId = managers.length > 0 ? managers[0].id : null
    
    // Update escalation and assignee
    updatedTicket = await context.entities.Ticket.update({
      where: { id: ticketId },
      data: {
        isEscalated: true,
        assigneeId: managerId !== null ? managerId : updatedTicket.assigneeId
      },
      include: {
        assignee: true,
        creator: true
      }
    })
  }
  
  return updatedTicket
}

export const resolveTicket = async (args: { ticketId: number }, context: any) => {
  if (!context.user) {
    throw new HttpError(401, 'Unauthorized')
  }
  return context.entities.Ticket.update({
    where: { id: args.ticketId },
    data: { status: 'RESOLVED' },
    include: {
      assignee: true,
      creator: true
    }
  })
}
