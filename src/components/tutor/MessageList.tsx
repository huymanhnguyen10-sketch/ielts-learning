"use client";

import { useEffect, useRef } from "react";
import type { Msg } from "./useChat";

export function MessageList({
  msgs,
  typing,
  compact,
  empty,
}: {
  msgs: Msg[];
  typing: boolean;
  compact?: boolean;
  empty: React.ReactNode;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs, typing]);

  const showEmpty = msgs.length === 0;
  const streamingLast = typing && msgs.length > 0 && msgs[msgs.length - 1].role === "assistant" && !msgs[msgs.length - 1].text;

  return (
    <>
      {showEmpty && empty}
      {msgs.map((m, i) => {
        if (i === msgs.length - 1 && streamingLast) return null;
        const user = m.role === "user";
        return (
          <div
            key={i}
            className="whitespace-pre-line"
            style={{
              alignSelf: user ? "flex-end" : "flex-start",
              maxWidth: compact ? "88%" : "85%",
              padding: compact ? "10px 14px" : "12px 16px",
              borderRadius: compact ? 12 : 14,
              background: user ? "#5B3FD9" : "#F5F3FF",
              color: user ? "#FFFFFF" : "#1E1B3A",
              fontSize: compact ? 14 : 15,
              lineHeight: compact ? 1.55 : 1.6,
            }}
          >
            {m.text}
          </div>
        );
      })}
      {streamingLast && (
        <div
          className="self-start rounded-[12px] bg-ground text-muted"
          style={{ padding: compact ? "8px 14px" : "10px 16px", fontSize: compact ? 13 : 14 }}
        >
          Tutor is thinking…
        </div>
      )}
      <div ref={endRef} />
    </>
  );
}
