"use client";

import { useToasts } from "@/lib/toast";

export default function Toaster() {
  const toasts = useToasts((st) => st.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="toaster" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast glass-strong glass">
          <span className="toast-emoji">{t.emoji}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
