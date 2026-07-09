"use client";

import { useEffect } from "react";

// La vitrine n'a pas de session/store (pas de SyncManager) : on applique
// quand même le thème clair/sombre du système, pour éviter qu'un visiteur en
// dark mode n'atterrisse sur une page entièrement claire.
export default function MarketingThemeSync() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.setAttribute("data-theme", media.matches ? "dark" : "light");
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  return null;
}
