import { component$ } from "@builder.io/qwik";
import { Form } from "@builder.io/qwik-city";
import type { useCreateTicket } from "../../routes/index";

interface TicketFormProps {
  action: ReturnType<typeof useCreateTicket>;
}

export const TicketForm = component$<TicketFormProps>(({ action }) => {
  const priorities = ["low", "medium", "high"] as const;

  return (
    <Form action={action}>
      <div>
        <label>
          Title
          <input
            type="text"
            name="title"
            value={action.value?.success ? "" : (action.formData?.get("title") as string)}
          />
        </label>
        {action.value?.fieldErrors?.title && (
          <p>{action.value.fieldErrors.title}</p>
        )}
      </div>

      <div>
        <label>
          Priority
          <select
            name="priority"
            value={action.value?.success ? "low" : (action.formData?.get("priority") as string || "low")}
          >
            {priorities.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        {action.value?.fieldErrors?.priority && (
          <p>{action.value.fieldErrors.priority}</p>
        )}
      </div>

      <div>
        <label>
          Description
          <textarea
            name="description"
            value={action.value?.success ? "" : (action.formData?.get("description") as string)}
          />
        </label>
        {action.value?.fieldErrors?.description && (
          <p>{action.value.fieldErrors.description}</p>
        )}
      </div>

      <button type="submit" disabled={action.isRunning}>
        {action.isRunning ? "Submitting..." : "Create ticket"}
      </button>

      {action.value?.success && <p>Ticket created: {action.value.title}</p>}
    </Form>
  );
});
