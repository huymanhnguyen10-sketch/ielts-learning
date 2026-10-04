"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getChat } from "@/lib/actions/chats";

export type Msg = { role: "user" | "assistant"; text: string };

const ACTIVE_KEY = "bandup:activeChat";
const ESSAY_KEY = "bandup:essay";

export function readActiveChatId(): number | null {
  try {
    const v = localStorage.getItem(ACTIVE_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

export function writeActiveChatId(id: number | null) {
  try {
    if (id == null) localStorage.removeItem(ACTIVE_KEY);
    else localStorage.setItem(ACTIVE_KEY, String(id));
  } catch {}
}

/** The Writing page keeps the current essay here so the tutor can see it. */
export function storeEssayForTutor(text: string) {
  try {
    sessionStorage.setItem(ESSAY_KEY, text);
  } catch {}
}

function readEssay(): string | undefined {
  try {
    return sessionStorage.getItem(ESSAY_KEY) || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Shared chat state for the full AI tutor page and the floating mini panel.
 * The active chat id lives in localStorage so both surfaces show the same thread.
 */
export function useChat(opts: { page: string; useContext: boolean; initialChatId?: number | null; onChanged?: () => void }) {
  const [chatId, setChatId] = useState<number | null>(opts.initialChatId ?? null);
  const [title, setTitle] = useState("New conversation");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [mode, setMode] = useState<"claude" | "offline" | null>(null);
  const loadedFor = useRef<number | null>(null);

  // Resolve the active chat on mount.
  useEffect(() => {
    if (opts.initialChatId !== undefined) return;
    setChatId(readActiveChatId());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load messages whenever the active chat changes.
  useEffect(() => {
    if (chatId == null) {
      setMsgs([]);
      setTitle("New conversation");
      loadedFor.current = null;
      return;
    }
    if (loadedFor.current === chatId) return;
    loadedFor.current = chatId;
    let cancelled = false;
    getChat(chatId).then((c) => {
      if (cancelled) return;
      if (!c) {
        writeActiveChatId(null);
        setChatId(null);
        return;
      }
      setTitle(c.title);
      setMsgs(c.messages.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", text: m.text })));
    });
    return () => {
      cancelled = true;
    };
  }, [chatId]);

  const openChat = useCallback((id: number | null) => {
    writeActiveChatId(id);
    loadedFor.current = null;
    setChatId(id);
  }, []);

  const newChat = useCallback(() => openChat(null), [openChat]);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || typing) return;
      setTyping(true);
      setMsgs((m) => [...m, { role: "user", text }, { role: "assistant", text: "" }]);
      if (chatId == null) setTitle(text.length > 42 ? text.slice(0, 42) + "…" : text);
      try {
        const res = await fetch("/api/tutor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatId,
            message: text,
            useContext: opts.useContext,
            page: opts.page,
            essay: opts.page === "/writing" ? readEssay() : undefined,
          }),
        });
        const id = Number(res.headers.get("X-Chat-Id"));
        const m = res.headers.get("X-Tutor-Mode");
        if (m === "claude" || m === "offline") setMode(m);
        if (id && id !== chatId) {
          writeActiveChatId(id);
          loadedFor.current = id; // we already hold the messages locally
          setChatId(id);
        }
        if (!res.ok || !res.body) {
          const err = await res.text();
          setMsgs((m) => [...m.slice(0, -1), { role: "assistant", text: err || "Something went wrong." }]);
          return;
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let acc = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          acc += dec.decode(value, { stream: true });
          const snapshot = acc;
          setMsgs((m) => [...m.slice(0, -1), { role: "assistant", text: snapshot }]);
        }
      } catch {
        setMsgs((m) => [...m.slice(0, -1), { role: "assistant", text: "Could not reach the tutor. Is the server running?" }]);
      } finally {
        setTyping(false);
        opts.onChanged?.();
      }
    },
    [chatId, typing, opts],
  );

  return { chatId, title, msgs, typing, mode, send, newChat, openChat, setMsgs };
}
