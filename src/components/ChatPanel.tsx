"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export type ChatBubble = { role: "user" | "assistant"; content: string; pending?: boolean };

export function ChatPanel({
  messages,
  onSend,
  placeholder,
  suggestions,
  busy,
  emptyState,
}: {
  messages: ChatBubble[];
  onSend: (text: string) => void;
  placeholder: string;
  suggestions?: string[];
  busy: boolean;
  emptyState?: React.ReactNode;
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function send(text: string) {
    if (!text.trim() || busy) return;
    onSend(text.trim());
    setInput("");
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && emptyState}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-neutral-900 text-white"
                  : "bg-white border border-neutral-200 text-neutral-900"
              }`}
            >
              {m.role === "assistant" ? (
                <div className="prose prose-sm max-w-none prose-table:text-xs prose-th:bg-neutral-50 prose-headings:mt-2 prose-headings:mb-1 prose-p:my-1.5">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                </div>
              ) : (
                <span className="whitespace-pre-wrap">{m.content}</span>
              )}
              {m.pending && (
                <span className="inline-flex gap-1 mt-1 align-middle">
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce" />
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {suggestions && suggestions.length > 0 && messages.length < 2 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={busy}
              className="text-xs px-3 py-1.5 rounded-full border border-neutral-300 text-neutral-700 hover:bg-neutral-100 disabled:opacity-40 text-left"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="border-t border-neutral-200 p-3 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder={placeholder}
          rows={1}
          disabled={busy}
          className="flex-1 resize-none rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:bg-neutral-50"
        />
        <button
          onClick={() => send(input)}
          disabled={busy || !input.trim()}
          className="px-4 py-2 rounded-md bg-neutral-900 text-white text-sm font-medium disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}
