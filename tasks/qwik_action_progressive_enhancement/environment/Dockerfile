# syntax=docker/dockerfile:1
FROM ubuntu:24.04

ARG POCHI_VERSION

# --- Base system, Node.js, Pochi CLI, Python + browser (Playwright) deps ---
RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        ffmpeg libxcb-shm0 libx11-xcb1 libx11-6 libxcb1 libxext6 libxrandr2 libxcomposite1 libxcursor1 libxdamage1 libxfixes3 libxi6 libgtk-3-0t64 libpangocairo-1.0-0 libpango-1.0-0 libatk1.0-0t64 libcairo-gobject2 libcairo2 libgdk-pixbuf-2.0-0 libxrender1 libasound2t64 libfreetype6 libfontconfig1 libdbus-1-3 libnss3 libnspr4 libatk-bridge2.0-0t64 libdrm2 libxkbcommon0 libatspi2.0-0t64 libcups2t64 libxshmfence1 libgbm1 && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf requests playwright pytest-xprocess && \
    python3 -m playwright install chromium && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# --- Scaffold the Qwik City app and configure lint-free build/serve scripts ---
RUN cd /home/user && \
    CI=true npm create qwik@latest empty /home/user/project --force < /dev/null && \
    cd /home/user/project && \
    npm pkg set scripts.build="vite build" && \
    npm pkg set scripts.serve="vite build && vite build --ssr src/entry.preview.tsx && vite preview --port 3000 --strictPort --host 0.0.0.0" && \
    sed -i 's/createQwikCity({/createQwikCity({ checkOrigin: false,/' src/entry.preview.tsx

# --- In-memory ticket store (server-only module) ---
RUN mkdir -p /home/user/project/src/lib && cat > /home/user/project/src/lib/tickets.ts <<'EOF'
export type Priority = "low" | "medium" | "high";

export interface Ticket {
  id: number;
  title: string;
  priority: Priority;
  description: string;
}

const tickets: Ticket[] = [
  {
    id: 1,
    title: "Set up CI pipeline",
    priority: "high",
    description: "Configure the continuous integration pipeline for the repo.",
  },
  {
    id: 2,
    title: "Write onboarding docs",
    priority: "low",
    description: "Document the local development setup for new engineers.",
  },
];

let nextId = 3;

export function listTickets(): Ticket[] {
  return tickets.map((t) => ({ ...t }));
}

export function addTicket(data: Omit<Ticket, "id">): Ticket {
  const ticket: Ticket = { id: nextId++, ...data };
  tickets.push(ticket);
  return ticket;
}
EOF

# --- Route: server loader + zod-validated action + page ---
RUN mkdir -p /home/user/project/src/routes && cat > /home/user/project/src/routes/index.tsx <<'EOF'
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
EOF

# --- Form component (SEEDED BROKEN: client-only submit, wrong error guard,
#     no value preservation). This is what the agent must repair. ---
RUN mkdir -p /home/user/project/src/components/ticket-form && cat > /home/user/project/src/components/ticket-form/ticket-form.tsx <<'EOF'
import { component$ } from "@builder.io/qwik";
import type { useCreateTicket } from "../../routes/index";

interface TicketFormProps {
  action: ReturnType<typeof useCreateTicket>;
}

export const TicketForm = component$<TicketFormProps>(({ action }) => {
  const priorities = ["low", "medium", "high"] as const;

  return (
    <form
      preventdefault:submit
      onSubmit$={(event) => {
        const form = event.target as HTMLFormElement;
        action.submit(new FormData(form));
      }}
    >
      <div>
        <label>
          Title
          <input type="text" name="title" />
        </label>
        {action.value?.success && <p>{action.value.fieldErrors?.title}</p>}
      </div>

      <div>
        <label>
          Priority
          <select name="priority">
            {priorities.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        {action.value?.success && <p>{action.value.fieldErrors?.priority}</p>}
      </div>

      <div>
        <label>
          Description
          <textarea name="description" />
        </label>
        {action.value?.success && <p>{action.value.fieldErrors?.description}</p>}
      </div>

      <button type="submit" disabled={action.isRunning}>
        {action.isRunning ? "Submitting..." : "Create ticket"}
      </button>

      {action.value?.success && <p>Ticket created: {action.value.title}</p>}
    </form>
  );
});
EOF

# --- Install dependencies so node_modules is present in the initial state ---
RUN cd /home/user/project && npm install

LABEL Author="generate-harbor-tasks"
LABEL Description="Qwik City v1.20.0 app with a progressively-enhanced routeAction$ ticket form seeded in a broken state; Node.js 22, Playwright/Chromium for browser verification."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v22 (via NodeSource) for the Qwik City app
#   - browser verification: Playwright + Chromium and its system libraries
#   - pip3 packages for tests: requests, playwright, pytest-xprocess
#   - /home/user/project: Qwik City v1.20.0 app (empty starter) with:
#       * src/lib/tickets.ts            in-memory ticket store (server-only)
#       * src/routes/index.tsx          routeLoader$ + zod$ routeAction$ + page
#       * src/components/ticket-form/ticket-form.tsx  SEEDED BROKEN form to repair
#       * build/serve scripts configured lint-free; preview CSRF origin check disabled

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
