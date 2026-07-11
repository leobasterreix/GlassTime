"use client";

import { create } from "zustand";

type Toast = { id: number; emoji: string; message: string; leaving?: boolean };

let nextId = 1;

export const useToasts = create<{
  toasts: Toast[];
  markLeaving: (id: number) => void;
  remove: (id: number) => void;
}>((set) => ({
  toasts: [],
  markLeaving: (id) =>
    set((st) => ({ toasts: st.toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t)) })),
  remove: (id) =>
    set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) })),
}));

/** Affiche un toast glass éphémère au-dessus de la barre d'onglets. */
export function toast(message: string, emoji = "✓") {
  const id = nextId++;
  useToasts.setState((st) => ({
    toasts: [...st.toasts.slice(-2), { id, emoji, message }],
  }));
  setTimeout(() => {
    useToasts.getState().markLeaving(id);
    // Sortie plus rapide que l'entrée (asymétrie intentionnelle) — doit
    // matcher la durée de l'animation .toast-leaving (180ms) dans globals.css.
    setTimeout(() => useToasts.getState().remove(id), 180);
  }, 2800);
}
