import { component$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, zod$, z } from "@builder.io/qwik-city";
import { TicketForm } from "../components/ticket-form/ticket-form";
import { addTicket, listTickets } from "../lib/tickets";

export const useTicketsLoader = routeLoader$(() => {
  return listTickets();
});

export const useCreateTicket = routeAction$(
  async (data) => {
    // Simulated database write latency. Keep this so the in-flight UI state
    // is observable on the JS-enhanced path.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const ticket = addTicket({
      title: data.title,
      priority: data.priority,
      description: data.description,
    });
    return { success: true, title: ticket.title };
  },
  zod$({
    title: z.string().min(3, "Title must be at least 3 characters"),
    priority: z.enum(["low", "medium", "high"], {
      errorMap: () => ({ message: "Priority must be low, medium, or high" }),
    }),
    description: z.string().min(10, "Description must be at least 10 characters"),
  }),
);

export default component$(() => {
  const tickets = useTicketsLoader();
  const createAction = useCreateTicket();

  return (
    <main>
      <h1>Support Tickets</h1>
      <ul>
        {tickets.value.map((ticket) => (
          <li key={ticket.id}>
            <span>{ticket.title}</span> — <span>{ticket.priority}</span>
          </li>
        ))}
      </ul>
      <h2>Create a ticket</h2>
      <TicketForm action={createAction} />
    </main>
  );
});
