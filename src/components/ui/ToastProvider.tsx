"use client";

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";

type ToastTone = "success" | "error" | "info";

type ToastInput = {
  title: string;
  message?: string;
  tone?: ToastTone;
  actionLabel?: string;
  onAction?: () => void;
};

type Toast = ToastInput & {
  id: string;
  createdAt: number;
  tone: ToastTone;
};

type ToastContextValue = {
  showToast: (toast: ToastInput) => void;
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);
const maxToasts = 4;
const duplicateWindowMs = 2500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((input: ToastInput) => {
    const createdAt = Date.now();
    const key = `${input.tone ?? "info"}:${input.title}:${input.message ?? ""}`;

    setToasts((current) => {
      const hasDuplicate = current.some(
        (toast) =>
          `${toast.tone}:${toast.title}:${toast.message ?? ""}` === key &&
          createdAt - toast.createdAt < duplicateWindowMs,
      );

      if (hasDuplicate) {
        return current;
      }

      return [
        {
          ...input,
          id: `${createdAt}-${Math.random().toString(36).slice(2)}`,
          createdAt,
          tone: input.tone ?? "info",
        },
        ...current,
      ].slice(0, maxToasts);
    });
  }, []);

  const value = useMemo(() => ({ dismissToast, showToast }), [dismissToast, showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions text"
        className="pointer-events-none fixed inset-x-0 top-4 z-[80] mx-auto flex w-full max-w-md flex-col gap-3 px-4 sm:left-auto sm:right-4 sm:mx-0"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} onDismiss={() => dismissToast(toast.id)} toast={toast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }

  return context;
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const toneClass = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    error: "border-[#F3C3CC] bg-[#F5E6E9] text-[#C8102E]",
    info: "border-[#DBE4EE] bg-white text-[#0D1B2A]",
  }[toast.tone];

  return (
    <div className={`pointer-events-auto rounded-2xl border p-4 shadow-xl shadow-slate-900/10 ${toneClass}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-extrabold">{toast.title}</p>
          {toast.message ? <p className="mt-1 text-sm leading-5 opacity-80">{toast.message}</p> : null}
        </div>
        <button
          aria-label="Lukk varsel"
          className="rounded-lg px-2 py-1 text-sm font-black opacity-70 transition hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E]"
          onClick={onDismiss}
          type="button"
        >
          x
        </button>
      </div>
      {toast.actionLabel && toast.onAction ? (
        <button
          className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-bold text-[#0D1B2A] ring-1 ring-black/10 transition hover:ring-[#C8102E]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E]"
          onClick={() => {
            toast.onAction?.();
            onDismiss();
          }}
          type="button"
        >
          {toast.actionLabel}
        </button>
      ) : null}
    </div>
  );
}
