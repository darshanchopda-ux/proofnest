"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

type ToastKind = "good" | "bad";
type ToastFn = (message: string, kind?: ToastKind) => void;

const ToastContext = createContext<ToastFn>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string; kind: ToastKind } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback<ToastFn>((message, kind = "good") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), message, kind });
    timer.current = setTimeout(() => setToast(null), 3600);
  }, []);

  return (
    <ToastContext value={show}>
      {children}
      <div role="status" aria-live="polite">
        {toast && (
          <div key={toast.id} className={`toast ${toast.kind === "bad" ? "bad" : ""}`}>
            <Icon name={toast.kind === "bad" ? "alert" : "check"} />
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    </ToastContext>
  );
}

export function useToast(): ToastFn {
  return useContext(ToastContext);
}
