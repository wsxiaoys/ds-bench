"use client";

import { useState, useRef, useCallback } from "react";
import { trpcClient } from "@/utils/trpc-client";

interface Message {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

/**
 * ChatStream page — demonstrates tRPC v11 AsyncGenerator streaming.
 *
 * Flow:
 *   1. User submits a message.
 *   2. The client calls `trpcClient.chatStream.query(input)`.
 *      - Because httpBatchStreamLink is used, tRPC knows this procedure
 *        returns an AsyncGenerator and reads the HTTP stream incrementally.
 *   3. We iterate the async iterable with `for await...of` and append
 *      each yielded chunk to the assistant message in real time.
 */
export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    // Add the user message
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setIsStreaming(true);

    // Append an empty assistant message that we'll fill as chunks arrive
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", isStreaming: true },
    ]);

    let cancelled = false;
    abortRef.current = () => {
      cancelled = true;
    };

    try {
      /**
       * trpcClient.chatStream.query() returns an AsyncIterable<string>
       * because the server procedure is an AsyncGenerator.
       * httpBatchStreamLink handles the chunked HTTP response and
       * exposes it as a standard async iterable — no extra setup needed.
       */
      const stream = await trpcClient.chatStream.query(trimmed);

      for await (const chunk of stream) {
        if (cancelled) break;

        // Append each yielded chunk to the last (assistant) message
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "assistant") {
            updated[updated.length - 1] = {
              ...last,
              content: last.content + chunk,
            };
          }
          return updated;
        });

        scrollToBottom();
      }
    } catch (err) {
      console.error("Stream error:", err);
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant") {
          updated[updated.length - 1] = {
            ...last,
            content:
              last.content || "⚠️ An error occurred while streaming the response.",
            isStreaming: false,
          };
        }
        return updated;
      });
    } finally {
      // Mark the assistant message as done streaming
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant") {
          updated[updated.length - 1] = { ...last, isStreaming: false };
        }
        return updated;
      });
      setIsStreaming(false);
      abortRef.current = null;
      scrollToBottom();
    }
  }, [input, isStreaming]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleStop = () => {
    abortRef.current?.();
  };

  return (
    <main className="flex flex-col h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-gray-800 px-6 py-4 bg-gray-900">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-xl font-semibold tracking-tight">
            tRPC v11 — AsyncGenerator Streaming
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Streamed over HTTP via{" "}
            <code className="bg-gray-800 px-1.5 py-0.5 rounded text-blue-400 text-xs">
              httpBatchStreamLink
            </code>{" "}
            ·{" "}
            <code className="bg-gray-800 px-1.5 py-0.5 rounded text-green-400 text-xs">
              AsyncGenerator
            </code>{" "}
            procedure
          </p>
        </div>
      </header>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-20 space-y-2">
              <p className="text-4xl">💬</p>
              <p className="text-lg font-medium text-gray-400">
                Start a conversation
              </p>
              <p className="text-sm text-gray-600">
                Try typing &ldquo;hello&rdquo; or &ldquo;trpc&rdquo; to see
                different streamed responses.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">
                  AI
                </div>
              )}

              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-sm"
                    : "bg-gray-800 text-gray-100 rounded-bl-sm"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">
                  {msg.content}
                  {msg.isStreaming && (
                    <span className="inline-block w-2 h-4 bg-blue-400 ml-0.5 align-middle animate-pulse rounded-sm" />
                  )}
                </p>
                {msg.role === "assistant" && !msg.isStreaming && msg.content && (
                  <p className="mt-1 text-xs text-gray-500">
                    ✓ Stream complete
                  </p>
                )}
              </div>

              {msg.role === "user" && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold">
                  U
                </div>
              )}
            </div>
          ))}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-gray-800 bg-gray-900 px-4 py-4">
        <div className="max-w-3xl mx-auto flex gap-3 items-end">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
              placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
              rows={1}
              className="w-full bg-gray-800 text-gray-100 placeholder-gray-500 rounded-xl px-4 py-3 pr-4 resize-none outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ minHeight: "48px", maxHeight: "160px" }}
            />
          </div>

          {isStreaming ? (
            <button
              onClick={handleStop}
              className="flex-shrink-0 bg-red-600 hover:bg-red-500 text-white rounded-xl px-4 py-3 text-sm font-medium transition-colors"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="flex-shrink-0 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-xl px-4 py-3 text-sm font-medium transition-colors"
            >
              Send
            </button>
          )}
        </div>

        {/* Status badge */}
        <div className="max-w-3xl mx-auto mt-2 flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isStreaming ? "bg-green-400 animate-pulse" : "bg-gray-600"
            }`}
          />
          <span className="text-xs text-gray-500">
            {isStreaming ? "Streaming via tRPC AsyncGenerator…" : "Ready"}
          </span>
        </div>
      </div>
    </main>
  );
}
