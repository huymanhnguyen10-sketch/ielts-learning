"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { STARTERS } from "@/lib/nav";
import { CloseIcon, SparkIcon } from "../Icons";
import { MessageList } from "./MessageList";
import { useChat } from "./useChat";

/** Floating "Ask AI tutor" button + mini chat panel (hidden on the full tutor page). */
export function TutorWidget() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [useCtx, setUseCtx] = useState(true);
  const chat = useChat({ page: pathname, useContext: useCtx });

  useEffect(() => {
    try {
      const v = localStorage.getItem("bandup:useCtx");
      if (v != null) setUseCtx(v === "1");
    } catch {}
  }, []);

  if (pathname === "/tutor") return null;
  const starters = STARTERS[pathname] || STARTERS["/"];

  const submit = () => {
    const t = input;
    setInput("");
    chat.send(t);
  };

  return (
    <>
      <button
        className="btn btn-p fixed z-20"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{ right: 24, bottom: 24, minHeight: 52, padding: "0 20px", borderRadius: 26, boxShadow: "0 8px 24px rgba(43, 27, 107, 0.28)" }}
      >
        <SparkIcon /> {open ? "Close tutor" : "Ask AI tutor"}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="AI tutor"
          className="fixed z-20 flex flex-col bg-surface"
          style={{
            right: 24,
            bottom: 90,
            width: "min(390px, calc(100vw - 32px))",
            maxHeight: "72vh",
            border: "1px solid #E4E0F5",
            borderRadius: 14,
            boxShadow: "0 16px 40px rgba(43, 27, 107, 0.22)",
          }}
        >
          <div className="flex items-center gap-2 border-b border-line px-3.5 py-3">
            <div className="min-w-0 flex-1">
              <div className="font-heading font-semibold">AI tutor</div>
              <div className="truncate text-xs text-muted">{chat.title}</div>
            </div>
            <button className="btn btn-sm" style={{ minHeight: 36 }} onClick={chat.newChat}>New</button>
            <button className="btn btn-sm" style={{ minHeight: 36 }} onClick={() => { setOpen(false); router.push("/tutor"); }}>
              History
            </button>
            <button className="btn" aria-label="Close AI tutor" style={{ minHeight: 36, minWidth: 36, padding: 4 }} onClick={() => setOpen(false)}>
              <CloseIcon />
            </button>
          </div>
          <div aria-live="polite" className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-3.5" style={{ minHeight: 220, maxHeight: 380 }}>
            <MessageList
              msgs={chat.msgs}
              typing={chat.typing}
              compact
              empty={
                <>
                  <p className="m-0 mb-1 text-sm text-muted">Ask about what you&apos;re working on. Try:</p>
                  {starters.slice(0, 3).map((s) => (
                    <button key={s} className="btn justify-start text-left text-sm" onClick={() => chat.send(s)}>
                      {s}
                    </button>
                  ))}
                </>
              }
            />
          </div>
          <div className="flex gap-2 border-t border-line px-3.5 py-3">
            <label className="sr" htmlFor="mini-input">Message the AI tutor</label>
            <input
              id="mini-input"
              className="inp"
              placeholder="Ask the tutor…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <button className="btn btn-p" onClick={submit} disabled={chat.typing}>Send</button>
          </div>
        </div>
      )}
    </>
  );
}
