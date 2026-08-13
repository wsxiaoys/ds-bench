import { component$, useSignal, useVisibleTask$, $ } from "@builder.io/qwik";
import { routeLoader$ } from "@builder.io/qwik-city";
import { docState } from "../server/state";

export const useInitialDoc = routeLoader$(() => {
  return {
    version: docState.getVersion(),
    text: docState.getText(),
  };
});

export default component$(() => {
  const initialDoc = useInitialDoc();
  const text = useSignal(initialDoc.value.text);
  const version = useSignal(initialDoc.value.version);
  const status = useSignal("reconnecting");

  useVisibleTask$(({ cleanup }) => {
    let eventSource: EventSource | null = null;
    let retryDelay = 1000;
    let timerId: any = null;
    let isUnmounted = false;

    const connect = () => {
      if (isUnmounted) return;
      
      status.value = "reconnecting";
      
      if (eventSource) {
        eventSource.close();
      }
      
      eventSource = new EventSource('/api/doc');
      
      eventSource.addEventListener('open', () => {
        status.value = "connected";
        retryDelay = 1000; // reset backoff
      });
      
      eventSource.addEventListener('update', (event) => {
        const newVersion = parseInt(event.lastEventId || event.id || '0', 10);
        const newText = event.data;
        
        if (newVersion > version.value) {
          version.value = newVersion;
          text.value = newText;
        }
      });
      
      eventSource.addEventListener('error', () => {
        if (isUnmounted) return;
        status.value = "reconnecting";
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        
        // Schedule reconnect with backoff
        if (timerId) {
          clearTimeout(timerId);
        }
        timerId = setTimeout(() => {
          connect();
        }, retryDelay);
        
        retryDelay = Math.min(retryDelay * 2, 16000);
      });
    };

    connect();

    cleanup(() => {
      isUnmounted = true;
      if (timerId) {
        clearTimeout(timerId);
      }
      if (eventSource) {
        eventSource.close();
      }
    });
  });

  const handleInput = $((event: Event, element: HTMLTextAreaElement) => {
    const newText = element.value;
    text.value = newText;

    fetch('/api/doc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: newText }),
    })
      .then((res) => {
        if (res.ok) {
          return res.json();
        }
        throw new Error('Failed to save');
      })
      .then((data) => {
        if (data.version > version.value) {
          version.value = data.version;
          text.value = data.text;
        }
      })
      .catch((err) => {
        console.error(err);
      });
  });

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Real-Time Collaborative Notepad</h1>
      <div style={{ marginBottom: "10px" }}>
        Status: <span data-testid="status" style={{ fontWeight: "bold" }}>{status.value}</span>
        {" | "}
        Version: <span data-testid="version" style={{ fontWeight: "bold" }}>{version.value}</span>
      </div>
      <div>
        <textarea
          data-testid="editor"
          value={text.value}
          onInput$={handleInput}
          style={{ width: "100%", height: "400px", fontSize: "16px", padding: "10px" }}
        />
      </div>
    </div>
  );
});
