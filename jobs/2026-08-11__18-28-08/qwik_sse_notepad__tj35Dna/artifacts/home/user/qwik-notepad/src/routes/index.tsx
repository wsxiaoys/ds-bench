import { component$, useSignal, useVisibleTask$, $ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";

export default component$(() => {
  const text = useSignal("");
  const version = useSignal(0);
  const status = useSignal("reconnecting");

  useVisibleTask$(({ cleanup }) => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;
    let retryDelay = 1000;

    const connect = () => {
      if (eventSource) {
        eventSource.close();
      }

      status.value = "reconnecting";
      eventSource = new EventSource("/api/doc");

      eventSource.onopen = () => {
        status.value = "connected";
        retryDelay = 1000;
      };

      eventSource.addEventListener("update", (event: any) => {
        const incomingVersion = parseInt(event.lastEventId || event.id || "0", 10);
        const incomingText = event.data;

        version.value = incomingVersion;
        if (text.value !== incomingText) {
          text.value = incomingText;
        }
      });

      eventSource.onerror = () => {
        status.value = "reconnecting";
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }

        clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(() => {
          retryDelay = Math.min(retryDelay * 2, 30000);
          connect();
        }, retryDelay);
      };
    };

    connect();

    cleanup(() => {
      if (eventSource) {
        eventSource.close();
      }
      clearTimeout(reconnectTimeout);
    });
  });

  const onInput$ = $(async (event: Event) => {
    const target = event.target as HTMLTextAreaElement;
    const newText = target.value;
    text.value = newText;

    try {
      await fetch("/api/doc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: newText }),
      });
    } catch (error) {
      /* eslint-disable-next-line no-console */
      console.error("Failed to send edit:", error);
    }
  });

  return (
    <div class="container">
      <h1>Real-Time Collaborative Notepad</h1>
      
      <div class="info">
        <span class="label">Status:</span>
        <span data-testid="status" class={`status ${status.value}`}>
          {status.value}
        </span>
        
        <span class="label">Version:</span>
        <span data-testid="version" class="version">
          {version.value}
        </span>
      </div>

      <textarea
        data-testid="editor"
        class="editor"
        value={text.value}
        onInput$={onInput$}
        placeholder="Type here to collaborate in real-time..."
      />
    </div>
  );
});

export const head: DocumentHead = {
  title: "Collaborative Notepad",
  meta: [
    {
      name: "description",
      content: "A real-time collaborative notepad with Qwik City and SSE",
    },
  ],
};
