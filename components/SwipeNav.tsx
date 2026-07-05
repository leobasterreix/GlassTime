"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Doit correspondre à Constants.nativeAppUserAgent côté app iOS (TabBar). */
const NATIVE_APP_UA_MARKER = "GlassTimeNativeApp";

const TAB_ORDER = ["/", "/discover", "/profile"];
const THRESHOLD = 120; // bien plus large qu'un swipe de carte, pour ne pas se déclencher par accident
const IGNORE_SELECTOR =
  ".hscroll, .grid-posters, button, a, input, textarea, select, [role='button']";

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

  useEffect(() => {
    setIsNativeApp(navigator.userAgent.includes(NATIVE_APP_UA_MARKER));
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
      axis.current = Math.abs(dx) > Math.abs(dy) * 1.5 ? "x" : "y";
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
    if (dx < 0 && idx < TAB_ORDER.length - 1) router.push(TAB_ORDER[idx + 1]);
    else if (dx > 0 && idx > 0) router.push(TAB_ORDER[idx - 1]);
  }

  if (pathname === "/login" || isNativeApp) return <>{children}</>;

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={reset}
    >
      {children}
    </div>
  );
}
