"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isNativeApp as detectNativeApp } from "@/lib/nativeApp";

const TAB_ORDER = ["/", "/upcoming", "/discover", "/profile"];
const THRESHOLD = 70; // distance horizontale pour changer d'onglet
// Éléments qui gèrent eux-mêmes un geste horizontal (carrousels) ou ne doivent
// pas être détournés (contrôles interactifs). On N'ignore PAS les cartes
// (.agenda-card/.swipe-row) ni les liens : SwipeableRow stoppe déjà la
// propagation quand il capte un swipe horizontal de carte, donc laisser
// SwipeNav écouter par-dessus est sans conflit — et c'est ce qui permet au
// swipe d'onglet de fonctionner sur le contenu (agenda, Avenir…).
const IGNORE_SELECTOR =
  ".hscroll, button, input, textarea, select, option, [role='button'], .BarcodeScanner, .scanner-container, .fav-btn, .notif-bell, .notif-panel";

/**
 * Swipe horizontal sur toute la page (pas sur une carte) pour changer
 * d'onglet : Agenda ↔ Découvrir ↔ Profil. Un swipe de carte (SwipeableRow)
 * stoppe la propagation dès qu'il se confirme horizontal, donc les deux
 * gestes ne se déclenchent jamais en même temps. Ignore aussi les carrousels
 * horizontaux natifs (.hscroll) et les contrôles interactifs, qui gèrent
 * déjà leur propre geste.
 */
export default function SwipeNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isNativeApp, setIsNativeApp] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const axis = useRef<"x" | "y" | null>(null);
  const skip = useRef(false);
  // Après un swipe d'onglet, on neutralise le clic qui suit : sur une carte-lien
  // (page Avenir, affiches…), le geste ne doit pas aussi ouvrir la fiche.
  const justSwiped = useRef(false);

  useEffect(() => {
    setIsNativeApp(detectNativeApp());
  }, []);

  function reset() {
    start.current = null;
    axis.current = null;
  }

  function handlePointerDown(e: React.PointerEvent) {
    const target = e.target as HTMLElement;
    skip.current = !!target.closest(IGNORE_SELECTOR);
    if (skip.current) return;
    start.current = { x: e.clientX, y: e.clientY };
    axis.current = null;
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (skip.current || !start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (!axis.current) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      axis.current = Math.abs(dx) > Math.abs(dy) * 1.2 ? "x" : "y";
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (skip.current || !start.current || axis.current !== "x") {
      reset();
      return;
    }
    const dx = e.clientX - start.current.x;
    reset();
    if (Math.abs(dx) < THRESHOLD) return;
    const idx = TAB_ORDER.indexOf(pathname);
    if (idx === -1) return;
    if (dx < 0 && idx < TAB_ORDER.length - 1) {
      justSwiped.current = true;
      router.push(TAB_ORDER[idx + 1]);
    } else if (dx > 0 && idx > 0) {
      justSwiped.current = true;
      router.push(TAB_ORDER[idx - 1]);
    }
  }

  function handleClickCapture(e: React.MouseEvent) {
    if (justSwiped.current) {
      justSwiped.current = false;
      e.preventDefault();
      e.stopPropagation();
    }
  }

  if (pathname === "/login" || isNativeApp) return <>{children}</>;

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={reset}
      onClickCapture={handleClickCapture}
    >
      {children}
    </div>
  );
}
