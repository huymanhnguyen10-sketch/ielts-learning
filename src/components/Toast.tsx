"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type ToastCtx = { toast: (msg: string) => void; message: string };
const Ctx = createContext<ToastCtx>({ toast: () => {}, message: "" });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((msg: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(msg);
    timer.current = setTimeout(() => setMessage(""), 3500);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return <Ctx.Provider value={{ toast, message }}>{children}</Ctx.Provider>;
}

export function useToast() {
  return useContext(Ctx).toast;
}

/** Status line shown under the page header (prototype's "flash"). */
export function FlashLine() {
  const { message } = useContext(Ctx);
  if (!message) return null;
  return (
    <div
      role="status"
      className="rounded-lg bg-primary-soft px-4 py-3 text-sm text-primary-text whitespace-pre-line"
    >
      {message}
    </div>
  );
}
