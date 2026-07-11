"use client";

import { useToasts } from "@/lib/toast";
import { EMOJI_ICONS } from "@/lib/toastIcons";

export default function Toaster() {
  const toasts = useToasts((st) => st.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="toaster" aria-live="polite">
      {toasts.map((t) => {
        const Icon = EMOJI_ICONS[t.emoji];
        return (
          <div key={t.id} className={`toast glass-strong glass${t.leaving ? " toast-leaving" : ""}`}>
            <span className="toast-emoji">{Icon ? <Icon size={16} /> : t.emoji}</span>
            <span>{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
