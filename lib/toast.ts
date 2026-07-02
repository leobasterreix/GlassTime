"use client";

import { create } from "zustand";

type Toast = { id: number; emoji: string; message: string };

let nextId = 1;

export const useToasts = create<{
  toasts: Toast[];
  remove: (id: number) => void;
}>((set) => ({
  toasts: [],
  remove: (id) =>
    set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) })),
}));

/** Affiche un toast glass éphémère au-dessus de la barre d'onglets. */
export function toast(message: string, emoji = "✓") {
  const id = nextId++;
  useToasts.setState((st) => ({
    toasts: [...st.toasts.slice(-2), { id, emoji, message }],
  }));
  setTimeout(() => useToasts.getState().remove(id), 2800);
}
