"use client";

// La navigation par swipe entre onglets a été retirée à la demande.
// Ce composant ne fait plus que rendre son contenu ; il est conservé pour ne
// pas modifier le layout (et pouvoir être ré-outillé plus tard si besoin).
export default function SwipeNav({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
