import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { routeLoader$ } from "@builder.io/qwik-city";
import { state } from "../state";

export const useInitialDoc = routeLoader$(() => {
  return {
    version: state.version,
    text: state.text,
  };
});

export default component$(() => {
  const initialDoc = useInitialDoc();
  const textSignal = useSignal(initialDoc.value.text);
  const versionSignal = useSignal(initialDoc.value.version);
  const statusSignal = useSignal("reconnecting");

  useVisibleTask$((taskContext) => {
    let eventSource: EventSource | null = null;
    let retryDelay = 1000;
    let isUnmounted = false;

    const connect = () => {
      if (isUnmounted) return;

      statusSignal.value = "reconnecting";
      eventSource = new EventSource("/api/doc");

      eventSource.onopen = () => {
        statusSignal.value = "connected";
        retryDelay = 1000;
      };

      eventSource.addEventListener("update", (event: MessageEvent) => {
        const text = event.data;
        const version = parseInt(event.lastEventId || "0", 10);

        if (version > versionSignal.value) {
          versionSignal.value = version;
          textSignal.value = text;
        }
      });

      eventSource.onerror = () => {
        statusSignal.value = "reconnecting";
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }

        const timeoutId = setTimeout(() => {
          connect();
        }, retryDelay);

        retryDelay = Math.min(retryDelay * 2, 30000);

        taskContext.cleanup(() => clearTimeout(timeoutId));
      };
    };

    connect();

    taskContext.cleanup(() => {
      isUnmounted = true;
      if (eventSource) {
        eventSource.close();
      }
    });
  });

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <h1>Real-Time Collaborative Notepad</h1>
      
      <div style={{ marginBottom: "10px", display: "flex", gap: "20px" }}>
        <div>
          Status: <strong data-testid="status">{statusSignal.value}</strong>
        </div>
        <div>
          Version: <strong data-testid="version">{versionSignal.value}</strong>
        </div>
      </div>

      <textarea
        data-testid="editor"
        value={textSignal.value}
        onInput$={async (event, el) => {
          const newText = el.value;
          textSignal.value = newText;

          try {
            const response = await fetch("/api/doc", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ text: newText }),
            });
            if (response.ok) {
              const data = await response.json();
              versionSignal.value = Math.max(versionSignal.value, data.version);
            }
          } catch (e) {
            console.error(e);
          }
        }}
        rows={15}
        style={{
          width: "100%",
          padding: "10px",
          fontSize: "16px",
          borderRadius: "4px",
          border: "1px solid #ccc",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
});
