# Customer Support Ticket System with SLA Countdowns & Automatic Assignment

## Background
Customer support teams rely on strict Service Level Agreements (SLAs) to ensure that high-priority client issues are addressed rapidly. You will build a Customer Support Ticket System with SLA countdowns and automatic, workload-based assignment using the Wasp framework (v0.24.0), which leverages React, Node.js, and Prisma.

## Requirements
- **Authentication**: Secure the application so only logged-in users can access the ticketing system. Enable username and password authentication.
- **User Roles**: Users can have roles: `CUSTOMER`, `AGENT`, or `MANAGER`.
- **Database Schema (`schema.prisma`)**:
  - A `User` model with fields:
    - `id` (Int, primary key, autoincrement)
    - `username` (String, unique)
    - `password` (String)
    - `role` (String, must support "CUSTOMER", "AGENT", and "MANAGER")
  - A `Ticket` model with fields:
    - `id` (Int, primary key, autoincrement)
    - `title` (String)
    - `description` (String)
    - `priority` (String, must accept "HIGH", "MEDIUM", or "LOW")
    - `status` (String, must accept "OPEN" or "RESOLVED", default is "OPEN")
    - `createdAt` (DateTime, default to `now()`)
    - `slaDeadline` (DateTime)
    - `isEscalated` (Boolean, default to `false`)
    - `assignee` (User, optional relation to `User` via `assigneeId`)
    - `assigneeId` (Int, optional)
    - `creator` (User, relation to `User` via `creatorId`)
    - `creatorId` (Int)
- **SLA Calculation**:
  - When a ticket is created, its `slaDeadline` must be automatically calculated based on its priority:
    - `HIGH`: 1 hour (3600 seconds) from creation time
    - `MEDIUM`: 4 hours (14400 seconds) from creation time
    - `LOW`: 24 hours (86400 seconds) from creation time
- **Automatic Workload-based Assignment**:
  - When a ticket is created, it must be automatically assigned to the AGENT (User with role "AGENT") who has the lowest number of active (unresolved, i.e., status is not "RESOLVED") tickets assigned to them.
  - If there is a tie (multiple agents have the same lowest workload), assign the ticket to the agent with the smallest `id`.
  - If no AGENT exists in the system, the assignee should remain null (unassigned).
- **Operations**:
  - **Query `getTickets`**: Returns all tickets, including assignee and creator relations.
  - **Query `getAgents`**: Returns all agents (Users with role "AGENT") along with their workload count (number of active/unresolved tickets assigned to them).
  - **Action `createTicket`**:
    - Input: `{ title: string, description: string, priority: "HIGH" | "MEDIUM" | "LOW" }`
    - Behavior: Creates and returns a new ticket linked to the logged-in user as the creator, calculates the SLA deadline, and assigns it automatically to the agent with the lowest workload.
  - **Action `simulateSlaBreach`**:
    - Input: `{ ticketId: number }`
    - Behavior: For the given ticket, subtracts exactly 2 hours from both `createdAt` and `slaDeadline` in the database to simulate time passing. Then, checks if the SLA has been breached (i.e., `slaDeadline` is in the past, status is not "RESOLVED", and `isEscalated` is false). If breached:
      - Sets `isEscalated` to `true`.
      - Reassigns the ticket to the manager (User with role "MANAGER"). If multiple managers exist, assign to the one with the smallest `id`. If no manager exists, keep the current assignee but still set `isEscalated` to `true`.
      - Returns the updated ticket.
- **Database Seeding**:
  - Implement a seed function `seedData` that creates:
    1. A manager: username `manager`, password `password123`, role `MANAGER`.
    2. Two agents:
       - `agent1`, password `password123`, role `AGENT`
       - `agent2`, password `password123`, role `AGENT`
    3. A customer: username `customer1`, password `password123`, role `CUSTOMER`.
- **Frontend UI & Test IDs**:
  - **`LoginPage` and `SignupPage`**: Use Wasp's built-in `LoginForm` and `SignupForm` components from `wasp/client/auth`.
  - **`MainPage`**:
    - Displays the logged-in user's username and role, and a logout button.
    - Displays a list of agents and their workloads. Each agent displayed must have an element with `data-testid="agent-workload-{username}"` displaying their current active ticket count (e.g., `0`, `1`, etc.).
    - Ticket Creation Form:
      - Title input: `<input type="text" id="ticket-title" data-testid="ticket-title" />`
      - Description textarea: `<textarea id="ticket-desc" data-testid="ticket-desc"></textarea>`
      - Priority select: `<select id="ticket-priority" data-testid="ticket-priority">` with options `HIGH`, `MEDIUM`, `LOW`.
      - Submit button: `<button id="submit-ticket" data-testid="submit-ticket">Submit Ticket</button>`
    - Ticket List:
      - Contains elements with `data-testid="ticket-item"` for each ticket.
      - Displays the ticket's title, priority, status, and assignee.
      - Displays SLA deadline: element with `data-testid="ticket-sla-deadline-{id}"` containing the ISO string or formatted date.
      - Displays assignee: element with `data-testid="ticket-assignee-{id}"` containing the assignee's username (or "Unassigned").
      - Displays escalation status: element with `data-testid="ticket-escalated-{id}"` containing either "Yes" (if escalated) or "No" (if not).
      - Displays ticket status badge: element with `data-testid="ticket-status-badge-{id}"` which displays "ESCALATED" if `isEscalated` is true, or the ticket's status (e.g. "OPEN" / "RESOLVED") otherwise.
      - Contains a "Simulate SLA Breach" button: `<button data-testid="simulate-breach-{id}">Simulate SLA Breach</button>` that triggers the `simulateSlaBreach` action for that ticket.

## Implementation Hints
- **Project Path**: `/home/user/app`
- **Start Command**: `wasp start`
- **Port**: `3000`
- **Wasp Version**: Target Wasp `^0.24.0` using the TypeScript configuration spec (`main.wasp.ts`). All configuration must be defined in `main.wasp.ts` using the `@wasp.sh/spec` package.

