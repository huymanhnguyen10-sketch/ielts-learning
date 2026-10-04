"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { Chat, ChatMessage } from "@prisma/client";
import { STARTERS } from "@/lib/nav";
import { deleteChat } from "@/lib/actions/chats";
import { setTutorUseContext } from "@/lib/actions/settings";
import { CloseIcon, PlusIcon, SparkIcon } from "../Icons";
import { MessageList } from "./MessageList";
import { readActiveChatId, useChat } from "./useChat";
import { useToast } from "../Toast";

type ChatWithMessages = Chat & { messages: ChatMessage[] };

export function TutorPage({
  chats,
  ctxChips,
  initialUseContext,
}: {
  chats: ChatWithMessages[];
  ctxChips: string[];
  initialUseContext: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [, start] = useTransition();
  const [useCtx, setUseCtx] = useState(initialUseContext);
  const [query, setQuery] = useState("");
  const [input, setInput] = useState("");
  const [activeFromStorage, setActiveFromStorage] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    setActiveFromStorage(readActiveChatId());
  }, []);

  const chat = useChat({
    page: "/tutor",
    useContext: useCtx,
    initialChatId: activeFromStorage === undefined ? null : activeFromStorage,
    onChanged: () => router.refresh(),
  });

  // Once localStorage is read, open that chat.
  useEffect(() => {
    if (activeFromStorage != null) chat.openChat(activeFromStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFromStorage]);

  const toggleCtx = () => {
    const v = !useCtx;
    setUseCtx(v);
    try { localStorage.setItem("bandup:useCtx", v ? "1" : "0"); } catch {}
    start(() => setTutorUseContext(v));
  };

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return chats.filter(
      (c) => !q || (c.title + " " + c.messages.map((m) => m.text).join(" ")).toLowerCase().includes(q),
    );
  }, [chats, query]);

  const starters = STARTERS["/"];
  const submit = () => {
    const t = input;
    setInput("");
    chat.send(t);
  };

  const remove = (id: number) => {
    start(async () => {
      const r = await deleteChat(id);
      toast(r.message);
      if (chat.chatId === id) chat.newChat();
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-stretch gap-4">
      <aside className="card flex min-w-0 flex-col gap-2.5 p-4" style={{ flex: "1 1 240px" }}>
        <button className="btn btn-p" onClick={chat.newChat}>
          <PlusIcon /> New chat
        </button>
        <input
          className="inp"
          type="search"
          aria-label="Search chat history"
          placeholder="Search history"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="mt-1.5 text-xs uppercase tracking-[0.08em] text-muted">Chat history</div>
        {list.length === 0 && (
          <p className="m-0 text-sm text-muted">{chats.length ? "No chats match." : "Your conversations will be saved here."}</p>
        )}
        <div className="flex flex-col gap-1.5">
          {list.map((c) => {
            const on = c.id === chat.chatId;
            const date = c.createdAt instanceof Date ? c.createdAt.toISOString().slice(0, 10) : String(c.createdAt).slice(0, 10);
            return (
              <div key={c.id} className="flex items-stretch gap-1">
                <button
                  className="btn min-w-0 flex-1 flex-col items-start gap-0.5 text-left"
                  style={{ background: on ? "#EEEAFE" : "#FFFFFF", borderColor: on ? "#5B3FD9" : "#D3CCEE" }}
                  onClick={() => chat.openChat(c.id)}
                >
                  <span className="max-w-full truncate font-semibold">{c.title}</span>
                  <span className="text-xs font-normal text-muted">{date} · {c.messages.length} messages</span>
                </button>
                <button className="btn" aria-label="Delete conversation" style={{ minWidth: 40, padding: 4 }} onClick={() => remove(c.id)}>
                  <CloseIcon />
                </button>
              </div>
            );
          })}
        </div>
      </aside>

      <section className="card flex min-w-0 flex-col" style={{ flex: "999 1 480px", minHeight: 640 }}>
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-accent">
              <SparkIcon />
            </div>
            <div>
              <div className="font-heading text-[17px] font-semibold">{chat.title}</div>
              <div className="text-xs text-muted">
                Your IELTS study coach · {chat.mode === "offline" ? "offline coach (add an API key for Claude)" : "powered by Claude"}
              </div>
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={useCtx} onChange={toggleCtx} className="h-[18px] w-[18px] accent-primary" />
            Use my progress as context
          </label>
        </div>
        {useCtx && (
          <div className="flex flex-wrap gap-1.5 border-b border-line bg-ground-2 px-5 py-2.5 text-[13px]">
            <span className="py-1 text-muted">The tutor can see:</span>
            {ctxChips.map((c) => (
              <span key={c} className="rounded-[12px] bg-primary-soft px-2.5 py-1 text-primary-text">{c}</span>
            ))}
          </div>
        )}
        <div aria-live="polite" className="flex flex-1 flex-col gap-3 overflow-y-auto p-5" style={{ maxHeight: 520 }}>
          <MessageList
            msgs={chat.msgs}
            typing={chat.typing}
            empty={
              <div className="my-auto px-2 py-6 text-center">
                <div className="font-heading text-2xl font-semibold">How can I help you study today?</div>
                <p className="mx-0 mb-5 mt-2 text-[15px] text-muted">Ask about any question type, get a study plan, or get quizzed on your phrases.</p>
                <div className="grid gap-2.5 text-left" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                  {starters.map((s) => (
                    <button key={s} className="btn justify-start text-left" style={{ minHeight: 56 }} onClick={() => chat.send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            }
          />
        </div>
        <div className="border-t border-line px-5 pb-[18px] pt-3.5">
          {chat.msgs.length > 0 && !chat.typing && (
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {starters.slice(0, 3).map((s) => (
                <button key={s} className="btn" style={{ minHeight: 32, padding: "4px 12px", fontSize: 13, borderRadius: 16 }} onClick={() => chat.send(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <label className="sr" htmlFor="tutor-input">Message the AI tutor</label>
            <textarea
              id="tutor-input"
              className="inp"
              rows={2}
              placeholder="Ask anything about IELTS… (Enter to send)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <button className="btn btn-p" style={{ minHeight: 52 }} onClick={submit} disabled={chat.typing}>Send</button>
          </div>
        </div>
      </section>
    </div>
  );
}
